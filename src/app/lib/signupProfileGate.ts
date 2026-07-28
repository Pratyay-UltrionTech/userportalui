/** Set when user completes sign-up on auth; ProfileSetup requires this flag. */
export const SIGNUP_PROFILE_PENDING_KEY = 'carwash_signup_profile_pending';

export function setSignupProfilePending(): void {
  try {
    sessionStorage.setItem(SIGNUP_PROFILE_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearSignupProfilePending(): void {
  try {
    sessionStorage.removeItem(SIGNUP_PROFILE_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSignupProfilePending(): boolean {
  try {
    return sessionStorage.getItem(SIGNUP_PROFILE_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}
