use anchor_lang::prelude::*;

use crate::{
    constants::{
        ISSUER_SEED, MAX_EVENT_NAME_LEN, MAX_SEAT_CATEGORY_LEN, MAX_URI_LEN, TICKET_SEED,
    },
    errors::MarketplaceError,
    events::{TicketCreated, TicketRedeemed},
    state::{Issuer, Ticket},
};

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
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(!event_name.is_empty(), MarketplaceError::EmptyName);
    require!(
        event_name.len() <= MAX_EVENT_NAME_LEN,
        MarketplaceError::NameTooLong
    );
    require!(
        seat_category.len() <= MAX_SEAT_CATEGORY_LEN,
        MarketplaceError::NameTooLong
    );
    require!(
        metadata_uri.len() <= MAX_URI_LEN,
        MarketplaceError::UriTooLong
    );
    require!(
        event_timestamp > now,
        MarketplaceError::EventInThePast
    );
    require!(
        transfer_deadline > now && transfer_deadline <= event_timestamp,
        MarketplaceError::InvalidTransferDeadline
    );
    require!(
        max_resale_price > 0,
        MarketplaceError::InvalidPrice
    );

    let ticket = &mut ctx.accounts.ticket;
    ticket.ticket_id = ticket_id;
    ticket.issuer = ctx.accounts.issuer.key();
    ticket.owner = ctx.accounts.authority.key();
    ticket.event_id = event_id;
    ticket.event_name = event_name;
    ticket.seat_category = seat_category;
    ticket.event_timestamp = event_timestamp;
    ticket.transfer_deadline = transfer_deadline;
    ticket.max_resale_price = max_resale_price;
    ticket.redeemed = false;
    ticket.metadata_uri = metadata_uri;
    ticket.bump = ctx.bumps.ticket;

    emit!(TicketCreated {
        ticket: ticket.key(),
        issuer: ticket.issuer,
        owner: ticket.owner,
        ticket_id: ticket.ticket_id,
        event_id: ticket.event_id,
        event_timestamp: ticket.event_timestamp,
        transfer_deadline: ticket.transfer_deadline,
        max_resale_price: ticket.max_resale_price,
    });

    Ok(())
}

pub fn redeem_ticket(ctx: Context<RedeemTicket>) -> Result<()> {
    let ticket = &mut ctx.accounts.ticket;
    require!(!ticket.redeemed, MarketplaceError::TicketRedeemed);
    ticket.redeemed = true;

    emit!(TicketRedeemed {
        ticket: ticket.key(),
        issuer: ticket.issuer,
        owner: ticket.owner,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(ticket_id: u64)]
pub struct CreateTicket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority,
        constraint = issuer.active @ MarketplaceError::IssuerInactive,
    )]
    pub issuer: Account<'info, Issuer>,

    #[account(
        init,
        payer = authority,
        space = 8 + Ticket::INIT_SPACE,
        seeds = [TICKET_SEED, issuer.key().as_ref(), &ticket_id.to_le_bytes()],
        bump,
    )]
    pub ticket: Account<'info, Ticket>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RedeemTicket<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [ISSUER_SEED, authority.key().as_ref()],
        bump = issuer.bump,
        has_one = authority,
        constraint = issuer.active @ MarketplaceError::IssuerInactive,
    )]
    pub issuer: Account<'info, Issuer>,

    #[account(
        mut,
        has_one = issuer,
        seeds = [TICKET_SEED, issuer.key().as_ref(), &ticket.ticket_id.to_le_bytes()],
        bump = ticket.bump,
    )]
    pub ticket: Account<'info, Ticket>,
}
