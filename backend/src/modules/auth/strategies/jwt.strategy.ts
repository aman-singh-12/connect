import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/services/users.service';

const userCache = new Map<
  string,
  { id: string; status: string; expiresAt: number }
>();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('auth.jwtSecret', 'changeme'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string }) {
    const now = Date.now();
    const cached = userCache.get(payload.sub);
    if (cached && cached.expiresAt > now) {
      if (cached.status !== 'active') {
        throw new UnauthorizedException();
      }
      return { userId: cached.id };
    }

    const dbUser = await this.usersService.findById(payload.sub);
    if (!dbUser || dbUser.status !== 'active') {
      throw new UnauthorizedException();
    }

    userCache.set(payload.sub, {
      id: dbUser.id,
      status: dbUser.status,
      expiresAt: now + 60000,
    });

    return { userId: dbUser.id };
  }
}
