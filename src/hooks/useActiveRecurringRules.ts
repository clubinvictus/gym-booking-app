import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirestore } from './useFirestore';
import { SITE_ID } from '../constants';

export interface RecurringRule {
    id: string;
    trainerId: string;
    time: string;
    days: number[];
    frequency: 'daily' | 'weekly';
    startDate: string;
    endDate: string | null;
    timezone?: string;
    exceptions?: string[];
    clientId?: string;
    serviceName?: string;
    status: string;
    [key: string]: any;
}

/**
 * Fetches every active recurring_series rule for the site — the source of truth for conflict-
 * checking beyond the materialized rolling window (a rule can run indefinitely; only a bounded
 * window of real `sessions` documents exists for it at any given time). Every availability-check
 * call site needs to check potentially several trainers at once (e.g. "all trainers assigned to
 * this service"), so this fetches once and callers filter per-trainer via isDateCoveredByRule
 * below, rather than each call site re-querying per trainer. Active-rule count for a whole site
 * is small (bounded by ongoing commitments, not by how far into the future they run) — cheaper
 * than the old unbounded trainer_busy_slots scan it replaces.
 */
export function useActiveRecurringRules() {
    const constraints = useMemo(() => (
        [where('siteId', '==', SITE_ID), where('status', '==', 'active')]
    ), []);

    const { data: rules } = useFirestore<RecurringRule>('recurring_series', constraints);
    return rules;
}

/**
 * True if any active rule covers this trainer at this local date ("YYYY-MM-DD") + time
 * ("09:00 AM"). Shared by every availability-check call site so the "does a rule cover this
 * slot" logic doesn't drift across BookingModal/WeekGrid/ResourceGrid/TrialBookingPage the way
 * the four independent busySlots-scan implementations already had before this.
 */
export function isDateCoveredByRule(rules: RecurringRule[], trainerId: string, dateStr: string, time: string): boolean {
    const date = new Date(dateStr + 'T00:00:00');
    const dayIdx = (date.getDay() + 6) % 7; // Mon=0..Sun=6, matching the app's convention

    return rules.some(rule => {
        if (rule.trainerId !== trainerId || rule.time !== time || rule.status !== 'active') return false;
        if (rule.exceptions?.includes(dateStr)) return false;
        if (rule.frequency !== 'daily' && !rule.days?.includes(dayIdx)) return false;

        const startDate = rule.startDate?.substring(0, 10);
        if (startDate && dateStr < startDate) return false;
        if (rule.endDate && dateStr > rule.endDate.substring(0, 10)) return false;

        return true;
    });
}
