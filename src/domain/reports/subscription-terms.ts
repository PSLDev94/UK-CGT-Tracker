import { ANNUAL_REPORT_PRICE } from "./access";

export type Trader = { legalName: string; address: string; registration?: string };
export const contractTitle = "CGT Tracker annual PDF subscription";

export function subscriptionTerms(trader: Trader) {
  const seller = trader.legalName === "PSL Digital" ? trader.legalName : trader.legalName + ", trading as PSL Digital";
  return [
    {
      heading: "Seller and support",
      text: `${seller}. Business address: ${trader.address}.${trader.registration ? " " + trader.registration + "." : ""} Contact support@cgttracker.com about your purchase, a complaint or an error. Include your invoice or calculation reference. Keep sensitive financial records out of your first message.`,
    },
    {
      heading: "Your subscription",
      text: `The total price is ${ANNUAL_REPORT_PRICE} for one year, payable in GBP by the methods shown in Stripe Checkout. PSL Digital is not VAT-registered. Your first payment starts access to downloadable PDF summaries and share-matching evidence in your verified account. You need internet access, a supported broker export and a PDF reader. Imports, calculations and CSV evidence remain free.`,
    },
    {
      heading: "Renewal and cancellation",
      text: `Your subscription renews each year at ${ANNUAL_REPORT_PRICE} until you cancel. Open Billing, then Manage subscription, to stop the next annual charge. Your existing access continues to the paid-through date shown there. Cancelling renewal keeps your investment records. Contact support if you need help with cancellation, a disputed charge or a refund.`,
    },
    {
      heading: "Your first 14 days",
      text: "UK consumers have 14 days starting the day after entering the subscription contract to cancel the initial purchase without giving a reason. You can request immediate PDF access and still exercise this right. Send a clear statement by email or post to the seller above before the deadline. Include your account email or invoice reference. We refund the original payment method within 14 days of receiving your notice. Any lawful deduction for services already supplied at your request is limited to a proportion of the annual price. Contact us to exercise this right even if you have already stopped renewal.",
    },
    {
      heading: "Optional cancellation form",
      text: "To the seller above: I give notice that I cancel my contract for the CGT Tracker annual PDF subscription. Ordered on: ____  Consumer’s name: ____  Consumer’s address: ____  Date: ____  Signature (paper notices only): ____.",
    },
    {
      heading: "Using your reports",
      text: "Reports explain ordinary-share gains and losses in taxable accounts from the transactions you supply. Check complete acquisition history, all taxable accounts, fees and the 30-day period after the tax year against your statements. Supported layouts and limits are at www.cgttracker.com/supported-brokers. The subscription supplies reports, not a review by a tax adviser, a calculation of your personal tax liability or filing with HMRC. Seek qualified advice if a transaction, valuation, relief or filing obligation is uncertain. Your statutory consumer rights, including reasonable care and skill, apply.",
    },
  ];
}

export function invoiceContractText(trader: Trader) {
  return [
    contractTitle,
    ...subscriptionTerms(trader).map(section => section.heading + "\n" + section.text),
  ].join("\n\n");
}
