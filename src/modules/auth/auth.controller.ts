import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  // OWASP A07: rate-limit auth endpoint stricter than the global default.
  // 20/min permite bursts legítimos (varios usuarios desde misma IP / NAT) pero
  // mantiene un límite firme contra brute-force.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Login mock (JWT HS256)',
    description:
      'Credenciales semilla: asesor / asesor123 · supervisor / super123 · admin / admin123',
  })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }
}
