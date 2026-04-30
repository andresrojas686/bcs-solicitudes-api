import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'asesor' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: 'asesor123' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class LoginResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() expiresIn!: string;
  @ApiProperty()
  user!: { id: string; username: string; nombres: string; roles: string[] };
}
