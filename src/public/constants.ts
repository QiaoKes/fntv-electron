import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

export const USER_DATA_PATH: string = path.join(app.getPath('home'), '.fntv');
