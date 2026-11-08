//! Seed constants and protocol limits shared across instructions.

/// PDA seed for the singleton [`crate::state::MarketplaceConfig`] account.
pub const MARKETPLACE_SEED: &[u8] = b"marketplace";
/// PDA seed prefix for [`crate::state::Issuer`] accounts: `["issuer", issuer_authority]`.
pub const ISSUER_SEED: &[u8] = b"issuer";
/// PDA seed prefix for [`crate::state::Ticket`] accounts: `["ticket", issuer, ticket_id]`.
pub const TICKET_SEED: &[u8] = b"ticket";
/// PDA seed prefix for listings: `["listing", asset]`.
pub const LISTING_SEED: &[u8] = b"listing";

/// Hard ceiling for the marketplace fee: 10% (1_000 basis points).
pub const MAX_FEE_BPS: u16 = 1_000;
/// Basis points denominator used for fee math.
pub const BPS_DENOMINATOR: u64 = 10_000;

pub const MAX_ISSUER_NAME_LEN: usize = 48;
pub const MAX_EVENT_NAME_LEN: usize = 64;
pub const MAX_SEAT_CATEGORY_LEN: usize = 48;
pub const MAX_URI_LEN: usize = 200;
