use anchor_lang::prelude::*;

use crate::{
    constants::{LISTING_SEED, MARKETPLACE_SEED},
    errors::MarketplaceError,
    events::{ListingCancelled, ListingCreated},
    state::{AssetType, Listing, ListingStatus, MarketplaceConfig, Ticket},
};

/// Move a ticket into marketplace custody and create its listing.
pub fn list_ticket(
    ctx: Context<ListTicket>,
    price_lamports: u64,
    expires_at: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let ticket = &mut ctx.accounts.ticket;

    require!(!ticket.redeemed, MarketplaceError::TicketRedeemed);
    require!(
        now < ticket.transfer_deadline,
        MarketplaceError::TransferWindowExpired
    );
    require!(price_lamports > 0, MarketplaceError::InvalidPrice);
    require!(
        price_lamports <= ticket.max_resale_price,
        MarketplaceError::ResalePriceAboveCap
    );
    require!(expires_at > now, MarketplaceError::InvalidExpiry);

    // Escrow: the marketplace config PDA becomes the recorded owner.
    ticket.owner = ctx.accounts.marketplace.key();

    let listing = &mut ctx.accounts.listing;
    listing.asset = ticket.key();
    listing.asset_type = AssetType::Ticket;
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

/// Cancel a ticket listing and return the ticket to the seller.
pub fn cancel_ticket_listing(ctx: Context<CancelTicketListing>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    let ticket = &mut ctx.accounts.ticket;

    listing.status = ListingStatus::Cancelled;
    ticket.owner = ctx.accounts.seller.key();

    emit!(ListingCancelled {
        listing: listing.key(),
        asset: listing.asset,
        asset_type: listing.asset_type,
        seller: listing.seller,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ListTicket<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
        constraint = !marketplace.paused @ MarketplaceError::MarketplacePaused,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    #[account(
        mut,
        constraint = ticket.owner == seller.key() @ MarketplaceError::NotAssetOwner,
    )]
    pub ticket: Account<'info, Ticket>,

    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [LISTING_SEED, ticket.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelTicketListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    #[account(
        mut,
        constraint = ticket.owner == marketplace.key() @ MarketplaceError::AssetNotEscrowed,
    )]
    pub ticket: Account<'info, Ticket>,

    #[account(
        mut,
        seeds = [LISTING_SEED, ticket.key().as_ref()],
        bump = listing.bump,
        has_one = seller,
        constraint = listing.asset == ticket.key() @ MarketplaceError::AssetMismatch,
        constraint = listing.asset_type == AssetType::Ticket @ MarketplaceError::AssetTypeMismatch,
        constraint = listing.status == ListingStatus::Active @ MarketplaceError::ListingNotActive,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,
}
