import { atom } from 'jotai'

export const userAtom = atom({
    "username": "",
    "email": "",
    "first_name": "",
    "last_name": "",
    "is_active": true
});

export const trackerSettingsAtom = atom({
    location_update_interval_minutes: 3,
    checkpoint_threshold_minutes: 15,
    proximity_range_meters: 50,
    notify_salesman_offline: true,
    notify_low_battery_alerts: true,
    notify_unusual_route_patterns: true,
    notify_daily_summary_reports: true,
});
export const isSidebarOpenAtom = atom(true);
export const activeProductAtom = atom({});
export const activeProductHistoryAtom = atom({});
export const glossaryAtom = atom({
    open: false,
    tabData: {},
});

export const errorsAtom = atom([])
export const warningsAtom = atom([])
export const successAtom = atom([])
export const infoAtom = atom([])
export const searchAtom = atom("");