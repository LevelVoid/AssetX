use anchor_lang::prelude::*;

use crate::constants::{
    MAX_EVENT_NAME_LEN, MAX_ISSUER_NAME_LEN, MAX_SEAT_CATEGORY_LEN, MAX_URI_LEN,
};

/// Singleton marketplace configuration and escrow authority.
///
/// Seeds: `["marketplace"]`. The account is deliberately read-only in listing and
/// purchase instructions, so no global writable account serializes the marketplace.
#[account]
#[derive(InitSpace)]
pub struct MarketplaceConfig {
    /// Administrator allowed to update config, register issuers and pause the market.
    pub authority: Pubkey,
    /// Receives marketplace fees.
    pub treasury: Pubkey,
    /// Marketplace fee in basis points, capped at [`crate::constants::MAX_FEE_BPS`].
    pub fee_bps: u16,
    /// When true, new listings and purchases are rejected.
    pub paused: bool,
    /// PDA bump.
    pub bump: u8,
}

/// Discriminates the two supported asset adapters behind one listing schema.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq, InitSpace)]
pub enum AssetType {
    Ticket,
    Collectible,
}

/// Lifecycle of a listing. Listing accounts are closed on sale or cancellation, so an
/// account that still exists should always be [`ListingStatus::Active`].
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq, InitSpace)]
pub enum ListingStatus {
    Active,
    Sold,
    Cancelled,
}

/// Shared listing schema for both asset adapters.
///
/// Seeds: `["listing", asset]`. The deterministic address guarantees at most one active
/// listing per asset, and the account is closed when the listing ends so the same PDA can be
/// reused by a later listing of the same asset.
#[account]
#[derive(InitSpace)]
pub struct Listing {
    /// Escrowed asset: a [`Ticket`] PDA or a Metaplex Core asset address.
    pub asset: Pubkey,
    /// Which adapter governs this asset.
    pub asset_type: AssetType,
    /// Seller and sole authority allowed to cancel.
    pub seller: Pubkey,
    /// Fixed asking price in lamports.
    pub price_lamports: u64,
    /// Listing creation time, unix seconds.
    pub created_at: i64,
    /// Listing expiry, unix seconds.
    pub expires_at: i64,
    /// Current listing status.
    pub status: ListingStatus,
    /// PDA bump.
    pub bump: u8,
}

/// A registered demo issuer permitted to mint tickets.
///
/// Seeds: `["issuer", issuer_authority]`.
#[account]
#[derive(InitSpace)]
pub struct Issuer {
    /// The key allowed to sign ticket issuance and redemption.
    pub authority: Pubkey,
    /// Display name of the issuer.
    #[max_len(MAX_ISSUER_NAME_LEN)]
    pub name: String,
    /// Off-chain metadata URI (logo / description).
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    /// Issuers that are not active cannot issue or redeem tickets.
    pub active: bool,
    /// PDA bump.
    pub bump: u8,
}

/// Anchor-managed event ticket. This account is the source of truth for ownership
/// and redemption state; no external program or metadata account can override it.
///
/// Seeds: `["ticket", issuer, ticket_id]`.
#[account]
#[derive(InitSpace)]
pub struct Ticket {
    /// Issuer-assigned unique identifier, scoped to the issuer.
    pub ticket_id: u64,
    /// Issuer PDA that minted the ticket.
    pub issuer: Pubkey,
    /// Current owner; equals the marketplace config PDA while the ticket is escrowed.
    pub owner: Pubkey,
    /// Identifier of the underlying (demo) event.
    pub event_id: u64,
    /// Human readable event name.
    #[max_len(MAX_EVENT_NAME_LEN)]
    pub event_name: String,
    /// Seat or ticket category (for example "General Stand").
    #[max_len(MAX_SEAT_CATEGORY_LEN)]
    pub seat_category: String,
    /// Event start time, unix seconds.
    pub event_timestamp: i64,
    /// Last unix timestamp at which the ticket may be transferred.
    pub transfer_deadline: i64,
    /// Issuer-configured resale ceiling in lamports.
    pub max_resale_price: u64,
    /// Set by the issuer once the ticket has been used / invalidated.
    pub redeemed: bool,
    /// Off-chain metadata URI for display assets.
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    /// PDA bump.
    pub bump: u8,
}
