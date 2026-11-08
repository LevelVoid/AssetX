//! Thin, explicit wrapper around the Metaplex Core transfer CPI.
//!
//! The marketplace never keeps a duplicate ownership record for collectibles: ownership is
//! read from the Core asset account and every movement goes through Core CPI.

use anchor_lang::prelude::*;
use mpl_core::{
    accounts::BaseAssetV1, instructions::TransferV1CpiBuilder, types::Key, ID,
};

use crate::errors::MarketplaceError;

/// Anchor account marker for the Metaplex Core program.
#[derive(Clone)]
pub struct MplCoreProgram;

impl anchor_lang::Id for MplCoreProgram {
    fn id() -> Pubkey {
        ID
    }
}

/// Deserialize a Metaplex Core asset account, verifying that the account is owned by the
/// Core program and really is an `AssetV1` (not a collection, group or plugin account).
pub fn read_core_asset(asset: &AccountInfo) -> Result<BaseAssetV1> {
    require_keys_eq!(
        *asset.owner,
        ID,
        MarketplaceError::InvalidCoreAsset
    );

    let decoded = BaseAssetV1::from_bytes(&asset.data.borrow())
        .map_err(|_| error!(MarketplaceError::InvalidCoreAsset))?;

    require!(
        decoded.key == Key::AssetV1,
        MarketplaceError::InvalidCoreAsset
    );

    Ok(decoded)
}

/// Accounts required by a Core `TransferV1` CPI.
pub struct CoreTransferAccounts<'a, 'info> {
    pub program: &'a AccountInfo<'info>,
    pub asset: &'a AccountInfo<'info>,
    pub collection: Option<&'a AccountInfo<'info>>,
    pub payer: &'a AccountInfo<'info>,
    pub authority: &'a AccountInfo<'info>,
    pub new_owner: &'a AccountInfo<'info>,
    pub system_program: &'a AccountInfo<'info>,
    pub log_wrapper: Option<&'a AccountInfo<'info>>,
}

/// Transfer a Core asset. `seeds` must be provided when the marketplace config PDA is the
/// current owner; the seller's signature authorizes the transfer in every other case.
pub fn transfer_core_asset(
    accounts: CoreTransferAccounts<'_, '_>,
    seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    let mut builder = TransferV1CpiBuilder::new(accounts.program);
    builder
        .asset(accounts.asset)
        .collection(accounts.collection)
        .payer(accounts.payer)
        .authority(Some(accounts.authority))
        .new_owner(accounts.new_owner)
        .system_program(Some(accounts.system_program))
        .log_wrapper(accounts.log_wrapper);

    match seeds {
        Some(seeds) => builder.invoke_signed(seeds)?,
        None => builder.invoke()?,
    }

    Ok(())
}
