import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a controller or route as accessible without JWT (used for /auth/login, /health, /api/docs). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
