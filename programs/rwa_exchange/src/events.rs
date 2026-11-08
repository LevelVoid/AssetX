use anchor_lang::prelude::*;

use crate::state::AssetType;

#[event]
pub struct MarketplaceInitialized {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct MarketplaceUpdated {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
}

#[event]
pub struct IssuerRegistered {
    pub issuer: Pubkey,
    pub authority: Pubkey,
    pub active: bool,
}

#[event]
pub struct IssuerStatusChanged {
    pub issuer: Pubkey,
    pub active: bool,
}

#[event]
pub struct TicketCreated {
    pub ticket: Pubkey,
    pub issuer: Pubkey,
    pub owner: Pubkey,
    pub ticket_id: u64,
    pub event_id: u64,
    pub event_timestamp: i64,
    pub transfer_deadline: i64,
    pub max_resale_price: u64,
}

#[event]
pub struct TicketRedeemed {
    pub ticket: Pubkey,
    pub issuer: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct ListingCreated {
    pub listing: Pubkey,
    pub asset: Pubkey,
    pub asset_type: AssetType,
    pub seller: Pubkey,
    pub price_lamports: u64,
    pub expires_at: i64,
}

#[event]
pub struct ListingCancelled {
    pub listing: Pubkey,
    pub asset: Pubkey,
    pub asset_type: AssetType,
    pub seller: Pubkey,
}

#[event]
pub struct AssetSold {
    pub listing: Pubkey,
    pub asset: Pubkey,
    pub asset_type: AssetType,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub price_lamports: u64,
    pub fee_lamports: u64,
}
