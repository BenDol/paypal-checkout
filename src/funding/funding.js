/* @flow */

import { ENV, CARD_PRIORITY, FUNDING, BUTTON_LAYOUT, FUNDING_ELIGIBILITY_REASON } from '../constants';

import { getFundingConfig, getCardConfig, FUNDING_PRIORITY, FUNDING_CONFIG } from './config';

let fundingEligibilityReasons = [];

function isFundingEligible(source : FundingSource, { locale, funding, env, layout, selected } :
    { locale : LocaleType, funding : FundingSelection, env : string, layout : string, selected : string }) : { eligible : boolean, reason : string } {

    if (source === selected) {
        return { eligible: true, reason: FUNDING_ELIGIBILITY_REASON.PRIMARY };
    }

    if (!getFundingConfig(source, 'enabled')) {
        if (!(env === ENV.TEST && getFundingConfig(source, 'test'))) {
            return { eligible: false, reason: FUNDING_ELIGIBILITY_REASON.NOT_ENABLED };
        }
    }

    let isVertical = layout === BUTTON_LAYOUT.VERTICAL;

    let allowSecondary = getFundingConfig(source, isVertical ? 'allowVertical' : 'allowHorizontal');

    if (!allowSecondary) {
        return { eligible: false, reason: FUNDING_ELIGIBILITY_REASON.SECONDARY_DISALLOWED };
    }

    if (funding.disallowed.indexOf(source) !== -1 && getFundingConfig(source, 'allowOptOut')) {
        return { eligible: false, reason: FUNDING_ELIGIBILITY_REASON.OPT_OUT };
    }

    if (funding.disallowed.indexOf(source) !== -1 && source === FUNDING.VENMO) {
        return { eligible: false, reason: FUNDING_ELIGIBILITY_REASON.OPT_OUT };
    }

    if (getFundingConfig(source, 'allowedCountries', [ locale.country ]).indexOf(locale.country) === -1) {
        return { eligible: false, reason: FUNDING_ELIGIBILITY_REASON.DISALLOWED_COUNTRY };
    }

    if (getFundingConfig(source, 'defaultCountries', []).indexOf(locale.country) !== -1) {
        return { eligible: true, reason: FUNDING_ELIGIBILITY_REASON.DEFAULT_COUNTRY };
    }

    if (isVertical && getFundingConfig(source, 'defaultVerticalCountries', []).indexOf(locale.country) !== -1) {
        return { eligible: true, reason: FUNDING_ELIGIBILITY_REASON.DEFAULT_COUNTRY };
    }

    if (getFundingConfig(source, 'default')) {
        return { eligible: true, reason: FUNDING_ELIGIBILITY_REASON.DEFAULT };
    }

    if (funding.allowed.indexOf(source) !== -1 && getFundingConfig(source, 'allowOptIn')) {
        return { eligible: true, reason: FUNDING_ELIGIBILITY_REASON.OPT_IN };
    }

    if (funding.remembered.indexOf(source) !== -1 && getFundingConfig(source, 'allowRemember')) {
        return { eligible: true, reason: FUNDING_ELIGIBILITY_REASON.REMEMBERED };
    }

    return { eligible: false, reason: FUNDING_ELIGIBILITY_REASON.NEED_OPT_IN };
}

export function determineEligibleFunding({ funding, selected, locale, env, layout } :
    { funding : FundingSelection, selected : FundingSource, locale : LocaleType, env : string, layout : string }) : FundingList {

    let reasons = {};

    let eligibleFunding = FUNDING_PRIORITY.filter(source => {
        let { eligible, reason } = isFundingEligible(source, { selected, locale, funding, env, layout });
        reasons[source] = { eligible, reason, factors: { env, locale, layout } };
        return eligible;
    });

    fundingEligibilityReasons.push(reasons);

    eligibleFunding.splice(eligibleFunding.indexOf(selected), 1);
    eligibleFunding.unshift(selected);

    return eligibleFunding;
}

export function determineEligibleCards({ funding, locale } :
    { funding : FundingSelection, locale : LocaleType }) : FundingList {

    return getCardConfig(locale.country, 'priority')
        .filter(card => funding.disallowed.indexOf(card) === -1);
}

export function validateFunding(funding : FundingSelection = { allowed: [], disallowed: [], remembered: [] }) {

    if (funding.allowed) {
        for (let source of funding.allowed) {
            if (CARD_PRIORITY.indexOf(source) !== -1) {
                continue;
            }

            if (!FUNDING_CONFIG.hasOwnProperty(source)) {
                throw new Error(`Invalid funding source: ${ source }`);
            }

            if (!getFundingConfig(source, 'allowOptIn')) {
                throw new Error(`Can not allow funding source: ${ source }`);
            }

            if (funding.disallowed && funding.disallowed.indexOf(source) !== -1) {
                throw new Error(`Can not allow and disallow funding source: ${ source }`);
            }
        }
    }

    if (funding.disallowed) {
        for (let source of funding.disallowed) {
            if (CARD_PRIORITY.indexOf(source) !== -1) {
                continue;
            }

            if (!FUNDING_CONFIG.hasOwnProperty(source)) {
                throw new Error(`Invalid funding source: ${ source }`);
            }

            if (!getFundingConfig(source, 'allowOptOut')) {
                throw new Error(`Can not disallow funding source: ${ source }`);
            }
        }
    }
}

export function logFundingEligibility() {
    fundingEligibilityReasons.forEach((reasons, i) => {
        console.log(`\nButton ${ i + 1 }:\n`); // eslint-disable-line no-console

        console.table(Object.keys(reasons).map(source => {  // eslint-disable-line no-console
            let { reason, eligible, factors } = reasons[source];

            return {
                'Funding':     source,
                'Reason':      reason,
                'Eligibility': eligible ? 'eligible' : 'ineligible',
                'Factors':     JSON.stringify(factors)
            };
        }));
    });
}
