/**
 * Turn a database or auth error into a message a person can act on.
 * Raw database text is never shown: unknown errors get a generic line and are logged for developers.
 */
const KNOWN: [RegExp, string][] = [
  [/donation_unavailable/, "Sorry, this food is no longer available."],
  [/invalid_quantity/, "That amount is more than what is left. Try a smaller amount."],
  [/own_donation/, "You can't reserve your own donation."],
  [/own_listing/, "You can't send an enquiry about your own listing."],
  [/too_many_reservations/, "You have reached the limit of active reservations. Collect or cancel one first."],
  [/account_suspended/, "Your account is suspended, so this action isn't available."],
  [/not_authenticated/, "Please log in to continue."],
  [/not_cancellable/, "This can no longer be cancelled."],
  [/not_collectable/, "This reservation has already been completed or cancelled."],
  [/not_allowed/, "You don't have permission to do that."],
  [/photo_required/, "Add at least one photo before publishing."],
  [/pickup_details_required/, "Add the pickup address before publishing."],
  [/deadline_in_past/, "The pickup deadline must be in the future."],
  [/quantity_locked/, "The quantity can't change once someone has reserved this food."],
  [/rate_limited/, "You've done that a lot today. Please try again tomorrow."],
  [/already_reported/, "You've already reported this. Thank you, we're looking at it."],
  [/insufficient_credits/, "You don't have enough promotional credits for this budget."],
  [/budget_too_low/, "The budget is below the minimum for a campaign."],
  [/dates_in_past/, "The campaign end date has already passed."],
  [/not_submittable/, "This campaign has already been submitted."],
  [/campaign_locked/, "This campaign can't be edited right now."],
  [/listing_unavailable/, "This listing is no longer available."],
  [/listing_removed/, "This listing was removed by a moderator."],
  [/reply_required/, "Write a reply first."],
  [/reason_required/, "Add a short reason."],
  [/not_paid/, "This campaign has not been paid for."],
  [/row-level security/, "You don't have permission to do that."],
  [/duplicate key|already exists/, "That already exists."],
  [/JWT|session/i, "Your session expired. Please log in again."],
  [/Failed to fetch|NetworkError|network/i, "Can't reach the server. Check your connection and try again."],
];

export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const message =
    typeof err === "string" ? err : err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
  for (const [re, text] of KNOWN) if (re.test(message)) return text;
  if (message && process.env.NODE_ENV !== "production") console.error("[CampusShare]", message);
  return fallback;
}
