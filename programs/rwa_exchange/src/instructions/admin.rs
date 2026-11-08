use anchor_lang::prelude::*;

use crate::{
    constants::{MARKETPLACE_SEED, MAX_FEE_BPS},
    errors::MarketplaceError,
    events::{MarketplaceInitialized, MarketplaceUpdated},
    state::MarketplaceConfig,
};

pub fn initialize_marketplace(
    ctx: Context<InitializeMarketplace>,
    fee_bps: u16,
    treasury: Pubkey,
) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, MarketplaceError::FeeTooHigh);

    let config = &mut ctx.accounts.marketplace;
    config.authority = ctx.accounts.authority.key();
    config.treasury = treasury;
    config.fee_bps = fee_bps;
    config.paused = false;
    config.bump = ctx.bumps.marketplace;

    emit!(MarketplaceInitialized {
        authority: config.authority,
        treasury: config.treasury,
        fee_bps: config.fee_bps,
    });

    Ok(())
}

pub fn update_marketplace(
    ctx: Context<UpdateMarketplace>,
    fee_bps: u16,
    treasury: Pubkey,
    paused: bool,
) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, MarketplaceError::FeeTooHigh);

    let config = &mut ctx.accounts.marketplace;
    config.fee_bps = fee_bps;
    config.treasury = treasury;
    config.paused = paused;

    emit!(MarketplaceUpdated {
        authority: config.authority,
        treasury: config.treasury,
        fee_bps: config.fee_bps,
        paused: config.paused,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: treasury only ever receives lamports; no data is read or written.
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + MarketplaceConfig::INIT_SPACE,
        seeds = [MARKETPLACE_SEED],
        bump,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMarketplace<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
        has_one = authority,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,
}
