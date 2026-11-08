use anchor_lang::prelude::*;

use crate::{
    constants::{LISTING_SEED, MARKETPLACE_SEED},
    errors::MarketplaceError,
    events::{ListingCancelled, ListingCreated},
    instructions::core_cpi::{
        read_core_asset, transfer_core_asset, CoreTransferAccounts, MplCoreProgram,
    },
    state::{AssetType, Listing, ListingStatus, MarketplaceConfig},
};

/// Move a Metaplex Core asset into marketplace custody and create its listing.
pub fn list_collectible(
    ctx: Context<ListCollectible>,
    price_lamports: u64,
    expires_at: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(price_lamports > 0, MarketplaceError::InvalidPrice);
    require!(expires_at > now, MarketplaceError::InvalidExpiry);

    let asset_info = ctx.accounts.asset.to_account_info();
    let asset = read_core_asset(&asset_info)?;
    require_keys_eq!(
        asset.owner,
        ctx.accounts.seller.key(),
        MarketplaceError::NotAssetOwner
    );

    let collection_info = ctx.accounts.collection.as_ref().map(|c| c.to_account_info());
    let log_wrapper_info = ctx.accounts.log_wrapper.as_ref().map(|c| c.to_account_info());
    let core_program_info = ctx.accounts.mpl_core_program.to_account_info();
    let seller_info = ctx.accounts.seller.to_account_info();
    let marketplace_info = ctx.accounts.marketplace.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    transfer_core_asset(
        CoreTransferAccounts {
            program: &core_program_info,
            asset: &asset_info,
            collection: collection_info.as_ref(),
            payer: &seller_info,
            authority: &seller_info,
            new_owner: &marketplace_info,
            system_program: &system_program_info,
            log_wrapper: log_wrapper_info.as_ref(),
        },
        None,
    )?;

    let listing = &mut ctx.accounts.listing;
    listing.asset = ctx.accounts.asset.key();
    listing.asset_type = AssetType::Collectible;
    listing.seller = ctx.accounts.seller.key();
    listing.price_lamports = price_lamports;
    listing.created_at = now;
    listing.expires_at = expires_at;
    listing.status = ListingStatus::Active;
    listing.bump = ctx.bumps.listing;

    emit!(ListingCreated {
        listing: listing.key(),
        asset: listing.asset,
        asset_type: listing.asset_type,
        seller: listing.seller,
        price_lamports: listing.price_lamports,
        expires_at: listing.expires_at,
    });

    Ok(())
}

/// Cancel a collectible listing and transfer the Core asset back to the seller.
pub fn cancel_collectible_listing(ctx: Context<CancelCollectibleListing>) -> Result<()> {
    let asset_info = ctx.accounts.asset.to_account_info();
    let asset = read_core_asset(&asset_info)?;
    require_keys_eq!(
        asset.owner,
        ctx.accounts.marketplace.key(),
        MarketplaceError::CoreEscrowMismatch
    );

    let collection_info = ctx.accounts.collection.as_ref().map(|c| c.to_account_info());
    let log_wrapper_info = ctx.accounts.log_wrapper.as_ref().map(|c| c.to_account_info());
    let core_program_info = ctx.accounts.mpl_core_program.to_account_info();
    let seller_info = ctx.accounts.seller.to_account_info();
    let marketplace_info = ctx.accounts.marketplace.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    let bump_seed = [ctx.accounts.marketplace.bump];
    let signer_seeds: &[&[u8]] = &[MARKETPLACE_SEED, &bump_seed];

    transfer_core_asset(
        CoreTransferAccounts {
            program: &core_program_info,
            asset: &asset_info,
            collection: collection_info.as_ref(),
            payer: &seller_info,
            authority: &marketplace_info,
            new_owner: &seller_info,
            system_program: &system_program_info,
            log_wrapper: log_wrapper_info.as_ref(),
        },
        Some(&[signer_seeds]),
    )?;

    let listing = &mut ctx.accounts.listing;
    listing.status = ListingStatus::Cancelled;

    emit!(ListingCancelled {
        listing: listing.key(),
        asset: listing.asset,
        asset_type: listing.asset_type,
        seller: listing.seller,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ListCollectible<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
        constraint = !marketplace.paused @ MarketplaceError::MarketplacePaused,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    /// CHECK: Metaplex Core asset; decoded and owner-verified in the handler.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: Optional Core collection account, forwarded to the Core program which
    /// validates the asset's collection membership itself.
    #[account(mut)]
    pub collection: Option<UncheckedAccount<'info>>,

    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [LISTING_SEED, asset.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    pub mpl_core_program: Program<'info, MplCoreProgram>,

    /// CHECK: Optional SPL Noop program forwarded to Metaplex Core for logging.
    pub log_wrapper: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelCollectibleListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    /// CHECK: Metaplex Core asset; decoded and escrow-verified in the handler.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: Optional Core collection account forwarded to the Core program.
    #[account(mut)]
    pub collection: Option<UncheckedAccount<'info>>,

    #[account(
        mut,
        seeds = [LISTING_SEED, asset.key().as_ref()],
        bump = listing.bump,
        has_one = seller,
        constraint = listing.asset_type == AssetType::Collectible @ MarketplaceError::AssetTypeMismatch,
        constraint = listing.status == ListingStatus::Active @ MarketplaceError::ListingNotActive,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    pub mpl_core_program: Program<'info, MplCoreProgram>,

    /// CHECK: Optional SPL Noop program forwarded to Metaplex Core for logging.
    pub log_wrapper: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}
