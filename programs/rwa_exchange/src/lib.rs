//! # RWA Exchange
//!
//! A Solana secondary marketplace for two kinds of transferable real-world asset
//! representations:
//!
//! * **Event tickets** — owned by custom Anchor accounts ([`state::Ticket`]). This
//!   program is the source of truth for ticket ownership and redemption state.
//! * **Digital collectibles** — owned by real Metaplex Core assets. The program
//!   validates Core ownership and moves assets with Core CPI; it never keeps a
//!   duplicate ownership record.
//!
//! Both adapters share one [`state::Listing`] schema and one native-SOL settlement
//! path. Listings are deterministic PDAs derived from the asset, so an asset can
//! have at most one active listing and independent listings settle independently.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("EosvnRWaZrdLWoSRCwp18QFMCL99GJJFTE1cEqhFJbuA");

#[program]
pub mod rwa_exchange {
    use super::*;

    // ---------------------------------------------------------------- admin

    /// Initialize the singleton marketplace configuration.
    pub fn initialize_marketplace(
        ctx: Context<InitializeMarketplace>,
        fee_bps: u16,
        treasury: Pubkey,
    ) -> Result<()> {
        instructions::admin::initialize_marketplace(ctx, fee_bps, treasury)
    }

    /// Update fee, treasury and pause state. Marketplace authority only.
    pub fn update_marketplace(
        ctx: Context<UpdateMarketplace>,
        fee_bps: u16,
        treasury: Pubkey,
        paused: bool,
    ) -> Result<()> {
        instructions::admin::update_marketplace(ctx, fee_bps, treasury, paused)
    }

    // --------------------------------------------------------------- issuer

    /// Register a demo issuer. Marketplace authority only.
    pub fn register_issuer(
        ctx: Context<RegisterIssuer>,
        name: String,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::issuer::register_issuer(ctx, name, metadata_uri)
    }

    /// Activate or deactivate an issuer. Marketplace authority only.
    pub fn set_issuer_active(ctx: Context<SetIssuerActive>, active: bool) -> Result<()> {
        instructions::issuer::set_issuer_active(ctx, active)
    }

    // --------------------------------------------------------------- ticket

    /// Issue a ticket. Only an active registered issuer may call this.
    #[allow(clippy::too_many_arguments)]
    pub fn create_ticket(
        ctx: Context<CreateTicket>,
        ticket_id: u64,
        event_id: u64,
        event_name: String,
        seat_category: String,
        event_timestamp: i64,
        transfer_deadline: i64,
        max_resale_price: u64,
        metadata_uri: String,
        owner: Pubkey,
    ) -> Result<()> {
        instructions::ticket::create_ticket(
            ctx,
            ticket_id,
            event_id,
            event_name,
            seat_category,
            event_timestamp,
            transfer_deadline,
            max_resale_price,
            metadata_uri,
            owner,
        )
    }

    /// Mark a ticket as redeemed. Only the issuing authority may call this.
    pub fn redeem_ticket(ctx: Context<RedeemTicket>) -> Result<()> {
        instructions::ticket::redeem_ticket(ctx)
    }

    // ------------------------------------------------------------ ticketing

    /// Escrow a ticket and create its listing.
    pub fn list_ticket(
        ctx: Context<ListTicket>,
        price_lamports: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::listing::list_ticket(ctx, price_lamports, expires_at)
    }

    /// Cancel a ticket listing and return the ticket to the seller.
    pub fn cancel_ticket_listing(ctx: Context<CancelTicketListing>) -> Result<()> {
        instructions::listing::cancel_ticket_listing(ctx)
    }

    // -------------------------------------------------------- collectibles

    /// Escrow a Metaplex Core asset with Core CPI and create its listing.
    pub fn list_collectible(
        ctx: Context<ListCollectible>,
        price_lamports: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::collectible::list_collectible(ctx, price_lamports, expires_at)
    }

    /// Cancel a collectible listing and transfer the Core asset back to the seller.
    pub fn cancel_collectible_listing(ctx: Context<CancelCollectibleListing>) -> Result<()> {
        instructions::collectible::cancel_collectible_listing(ctx)
    }
}
