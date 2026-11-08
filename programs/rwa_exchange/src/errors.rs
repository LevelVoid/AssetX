use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Marketplace fee exceeds the maximum allowed basis points")]
    FeeTooHigh,
    #[msg("Marketplace is paused")]
    MarketplacePaused,
    #[msg("Issuer is not active")]
    IssuerInactive,
    #[msg("Issuer authority does not match the issuer account")]
    IssuerAuthorityMismatch,
    #[msg("Name must not be empty")]
    EmptyName,
    #[msg("Name is longer than the allowed maximum")]
    NameTooLong,
    #[msg("Metadata URI is longer than the allowed maximum")]
    UriTooLong,
    #[msg("Ticket has already been redeemed")]
    TicketRedeemed,
    #[msg("Ticket transfer window has expired")]
    TransferWindowExpired,
    #[msg("Event must be in the future")]
    EventInThePast,
    #[msg("Transfer deadline must be in the future and no later than the event")]
    InvalidTransferDeadline,
    #[msg("Resale price must be greater than zero")]
    InvalidPrice,
    #[msg("Resale price exceeds the issuer cap")]
    ResalePriceAboveCap,
    #[msg("Listing expiry must be in the future")]
    InvalidExpiry,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Listing has expired")]
    ListingExpired,
    #[msg("Asset type does not match the listing")]
    AssetTypeMismatch,
    #[msg("Seller cannot buy their own listing")]
    SelfPurchase,
    #[msg("Underlying asset is not held in marketplace escrow")]
    AssetNotEscrowed,
    #[msg("Asset account does not match the listing")]
    AssetMismatch,
    #[msg("Metaplex Core asset is not owned by the expected account")]
    CoreOwnerMismatch,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Ticket owner must be a valid public key")]
    InvalidTicketOwner,
    #[msg("Signer does not own the asset being listed")]
    NotAssetOwner,
    #[msg("Account is not a valid Metaplex Core asset")]
    InvalidCoreAsset,
    #[msg("Asset is not a Metaplex Core asset owned by the marketplace escrow")]
    CoreEscrowMismatch,
}
