import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthCheck(): string {
    console.debug('Health check');
    return 'OK!';
  }
}
