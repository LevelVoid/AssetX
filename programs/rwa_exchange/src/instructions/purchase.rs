use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{
    constants::{BPS_DENOMINATOR, LISTING_SEED, MARKETPLACE_SEED, TICKET_SEED},
    errors::MarketplaceError,
    events::AssetSold,
    instructions::core_cpi::{
        read_core_asset, transfer_core_asset, CoreTransferAccounts, MplCoreProgram,
    },
    state::{AssetType, Listing, ListingStatus, MarketplaceConfig, Ticket},
};

/// Split `price` into seller proceeds and marketplace fee.
fn split_price(price: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let fee_u128 = (price as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        / (BPS_DENOMINATOR as u128);
    let fee = u64::try_from(fee_u128).map_err(|_| MarketplaceError::ArithmeticOverflow)?;
    let seller_amount = price
        .checked_sub(fee)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;
    Ok((seller_amount, fee))
}

/// Pay the seller and the treasury directly from the buyer in the same transaction.
fn settle_payment<'info>(
    buyer: &AccountInfo<'info>,
    seller: &AccountInfo<'info>,
    treasury: &AccountInfo<'info>,
    price_lamports: u64,
    fee_bps: u16,
) -> Result<u64> {
    let (seller_amount, fee) = split_price(price_lamports, fee_bps)?;

    if seller_amount > 0 {
        system_program::transfer(
            CpiContext::new(
                system_program::ID,
                system_program::Transfer {
                    from: buyer.clone(),
                    to: seller.clone(),
                },
            ),
            seller_amount,
        )?;
    }

    if fee > 0 {
        system_program::transfer(
            CpiContext::new(
                system_program::ID,
                system_program::Transfer {
                    from: buyer.clone(),
                    to: treasury.clone(),
                },
            ),
            fee,
        )?;
    }

    Ok(fee)
}

/// Buy a listed ticket. Payment and ownership transfer are atomic: either the buyer pays
/// and receives the ticket, or the whole transaction is rejected.
pub fn buy_ticket(ctx: Context<BuyTicket>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let listing = &ctx.accounts.listing;

    require!(now < listing.expires_at, MarketplaceError::ListingExpired);
    require!(
        listing.price_lamports > 0,
        MarketplaceError::InvalidPrice
    );

    let ticket = &mut ctx.accounts.ticket;
    require!(!ticket.redeemed, MarketplaceError::TicketRedeemed);
    require!(
        now < ticket.transfer_deadline,
        MarketplaceError::TransferWindowExpired
    );

    let price = listing.price_lamports;
    let fee = settle_payment(
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        &ctx.accounts.treasury.to_account_info(),
        price,
        ctx.accounts.marketplace.fee_bps,
    )?;

    ticket.owner = ctx.accounts.buyer.key();

    let listing = &mut ctx.accounts.listing;
    listing.status = ListingStatus::Sold;

    emit!(AssetSold {
        listing: listing.key(),
        asset: listing.asset,
        asset_type: AssetType::Ticket,
        seller: listing.seller,
        buyer: ctx.accounts.buyer.key(),
        price_lamports: price,
        fee_lamports: fee,
    });

    Ok(())
}

/// Buy a listed Metaplex Core asset. Payment and the Core ownership transfer are atomic.
pub fn buy_collectible(ctx: Context<BuyCollectible>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let listing = &ctx.accounts.listing;

    require!(now < listing.expires_at, MarketplaceError::ListingExpired);
    require!(
        listing.price_lamports > 0,
        MarketplaceError::InvalidPrice
    );

    let asset_info = ctx.accounts.asset.to_account_info();
    let asset = read_core_asset(&asset_info)?;
    require_keys_eq!(
        asset.owner,
        ctx.accounts.marketplace.key(),
        MarketplaceError::CoreEscrowMismatch
    );

    let price = listing.price_lamports;
    let fee = settle_payment(
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        &ctx.accounts.treasury.to_account_info(),
        price,
        ctx.accounts.marketplace.fee_bps,
    )?;

    let collection_info = ctx.accounts.collection.as_ref().map(|c| c.to_account_info());
    let log_wrapper_info = ctx.accounts.log_wrapper.as_ref().map(|c| c.to_account_info());
    let core_program_info = ctx.accounts.mpl_core_program.to_account_info();
    let buyer_info = ctx.accounts.buyer.to_account_info();
    let marketplace_info = ctx.accounts.marketplace.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    let bump_seed = [ctx.accounts.marketplace.bump];
    let signer_seeds: &[&[u8]] = &[MARKETPLACE_SEED, &bump_seed];

    transfer_core_asset(
        CoreTransferAccounts {
            program: &core_program_info,
            asset: &asset_info,
            collection: collection_info.as_ref(),
            payer: &buyer_info,
            authority: &marketplace_info,
            new_owner: &buyer_info,
            system_program: &system_program_info,
            log_wrapper: log_wrapper_info.as_ref(),
        },
        Some(&[signer_seeds]),
    )?;

    let listing = &mut ctx.accounts.listing;
    listing.status = ListingStatus::Sold;

    emit!(AssetSold {
        listing: listing.key(),
        asset: listing.asset,
        asset_type: AssetType::Collectible,
        seller: listing.seller,
        buyer: ctx.accounts.buyer.key(),
        price_lamports: price,
        fee_lamports: fee,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
        has_one = treasury,
        constraint = !marketplace.paused @ MarketplaceError::MarketplacePaused,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    #[account(
        mut,
        seeds = [TICKET_SEED, ticket.issuer.as_ref(), &ticket.ticket_id.to_le_bytes()],
        bump = ticket.bump,
        constraint = ticket.owner == marketplace.key() @ MarketplaceError::AssetNotEscrowed,
    )]
    pub ticket: Account<'info, Ticket>,

    /// CHECK: receives the sale proceeds; equality with the listing seller is enforced.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: receives the marketplace fee; equality with the config treasury is enforced.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [LISTING_SEED, ticket.key().as_ref()],
        bump = listing.bump,
        has_one = seller,
        constraint = listing.asset == ticket.key() @ MarketplaceError::AssetMismatch,
        constraint = listing.asset_type == AssetType::Ticket @ MarketplaceError::AssetTypeMismatch,
        constraint = listing.status == ListingStatus::Active @ MarketplaceError::ListingNotActive,
        constraint = listing.seller != buyer.key() @ MarketplaceError::SelfPurchase,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyCollectible<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
        has_one = treasury,
        constraint = !marketplace.paused @ MarketplaceError::MarketplacePaused,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    /// CHECK: Metaplex Core asset; decoded, escrow-verified and transferred in the handler.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: Optional Core collection account forwarded to the Core program.
    #[account(mut)]
    pub collection: Option<UncheckedAccount<'info>>,

    /// CHECK: receives the sale proceeds; equality with the listing seller is enforced.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: receives the marketplace fee; equality with the config treasury is enforced.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [LISTING_SEED, asset.key().as_ref()],
        bump = listing.bump,
        has_one = seller,
        constraint = listing.asset_type == AssetType::Collectible @ MarketplaceError::AssetTypeMismatch,
        constraint = listing.status == ListingStatus::Active @ MarketplaceError::ListingNotActive,
        constraint = listing.seller != buyer.key() @ MarketplaceError::SelfPurchase,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    pub mpl_core_program: Program<'info, MplCoreProgram>,

    /// CHECK: Optional SPL Noop program forwarded to Metaplex Core for logging.
    pub log_wrapper: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}
