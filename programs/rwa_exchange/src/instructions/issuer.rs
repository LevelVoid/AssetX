use anchor_lang::prelude::*;

use crate::{
    constants::{ISSUER_SEED, MARKETPLACE_SEED, MAX_ISSUER_NAME_LEN, MAX_URI_LEN},
    errors::MarketplaceError,
    events::{IssuerRegistered, IssuerStatusChanged},
    state::{Issuer, MarketplaceConfig},
};

pub fn register_issuer(
    ctx: Context<RegisterIssuer>,
    name: String,
    metadata_uri: String,
) -> Result<()> {
    require!(!name.is_empty(), MarketplaceError::EmptyName);
    require!(
        name.len() <= MAX_ISSUER_NAME_LEN,
        MarketplaceError::NameTooLong
    );
    require!(
        metadata_uri.len() <= MAX_URI_LEN,
        MarketplaceError::UriTooLong
    );

    let issuer = &mut ctx.accounts.issuer;
    issuer.authority = ctx.accounts.issuer_authority.key();
    issuer.name = name;
    issuer.metadata_uri = metadata_uri;
    issuer.active = true;
    issuer.bump = ctx.bumps.issuer;

    emit!(IssuerRegistered {
        issuer: issuer.key(),
        authority: issuer.authority,
        active: issuer.active,
    });

    Ok(())
}

pub fn set_issuer_active(ctx: Context<SetIssuerActive>, active: bool) -> Result<()> {
    let issuer = &mut ctx.accounts.issuer;
    issuer.active = active;

    emit!(IssuerStatusChanged {
        issuer: issuer.key(),
        active: issuer.active,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RegisterIssuer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
        has_one = authority,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    /// CHECK: only used as the `issuer` PDA seed; issued tickets are signed by this key.
    pub issuer_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Issuer::INIT_SPACE,
        seeds = [ISSUER_SEED, issuer_authority.key().as_ref()],
        bump,
    )]
    pub issuer: Account<'info, Issuer>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetIssuerActive<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
        has_one = authority,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,

    #[account(
        mut,
        seeds = [ISSUER_SEED, issuer.authority.as_ref()],
        bump = issuer.bump,
    )]
    pub issuer: Account<'info, Issuer>,
}
