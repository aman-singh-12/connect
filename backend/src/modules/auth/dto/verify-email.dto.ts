import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  token: string;
}
