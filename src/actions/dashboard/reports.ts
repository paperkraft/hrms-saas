"use server"

import { getAdminReportsData as getMonthly } from './reports/monthly';
import { getAdminYearlyReportsData as getYearly } from './reports/yearly';
import { getMonthlyChampions as getChampions } from './reports/champions';

export async function getAdminReportsData(reqMonth?: number, reqYear?: number, bypassAuth: boolean = false) {
  return getMonthly(reqMonth, reqYear, bypassAuth);
}

export async function getAdminYearlyReportsData(reqYear?: number) {
  return getYearly(reqYear);
}

export async function getMonthlyChampions() {
  return getChampions();
}
