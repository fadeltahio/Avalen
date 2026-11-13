// Arabic translations, one file per area of the app.
import accounts from './accounts.js';
import checkins from './checkins.js';
import client from './client.js';
import coach from './coach.js';
import community from './community.js';
import ecosystem from './ecosystem.js';
import exercises from './exercises.js';
import extras from './extras.js';
import library from './library.js';
import paymentsWearables from './payments-wearables.js';
import screens from './screens.js';
import server from './server.js';
import shell from './shell.js';

export default { ...accounts, ...exercises, ...extras, ...library, ...server, ...community, ...ecosystem, ...paymentsWearables, ...checkins, ...coach, ...client, ...shell, ...screens };
