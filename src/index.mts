import chalk from 'chalk';
import { access, appendFile, readdir, readFile, rename, writeFile } from 'fs/promises';
import { basename, dirname, join, extname } from 'path';
import * as readline from 'readline/promises';
import { fileURLToPath } from 'url';
import { ClipFile, ClipInfo, ClipInfoResponse, TokenInfo } from './types.mjs';
import { exit, stdin, stdout } from 'process';


const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);

let CLIENT_ID: string = ''; 
let CLIENT_SECRET: string = ''; 

let CLIENT_TOKEN: string = ''; 

const API_OAuth_URI = 'https://id.twitch.tv/oauth2/token';
const API_OAuth_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded'
}; 
const API_OAuth_DATA = () => ({
  'client_id': `${CLIENT_ID}`, 
  'client_secret': `${CLIENT_SECRET}`,
  'grant_type': 'client_credentials'
});

const API_GetClips_URI = 'https://api.twitch.tv/helix/clips';
const API_GetClips_HEADERS = () => ({
  'Authorization': `Bearer ${CLIENT_TOKEN}`,
  'Client-Id': `${CLIENT_ID}`
}); 


const __AUTH_ID_PATH = join(__dirname, 'auth_id'); 
const __AUTH_SECRET_PATH = join(__dirname, 'auth_secret'); 
const __DEBUG_LOG = join(__dirname, 'debug.log'); 
const __RENAME_LOG = join(__dirname, 'rename.log'); 


async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (err: any) {
    if (err.code === 'ENOENT') return false;
    
    throw err;
  }
}


async function readStoredCredentials(): Promise<void> {
  console.log(chalk.magentaBright('  >  '), chalk.magenta('Saved Client Id and Secret found. Using stored credentials.'));
  console.log(
    chalk.magentaBright('  >  '),
    chalk.magenta(`(Delete ${chalk.magentaBright(basename(__AUTH_ID_PATH))} and ${chalk.magentaBright(basename(__AUTH_SECRET_PATH))} files to clear stored credentials).`)
  );

  try {
    CLIENT_ID = await readFile(__AUTH_ID_PATH, 'utf-8'); 

    CLIENT_SECRET = await readFile(__AUTH_SECRET_PATH, 'utf-8'); 
  }
  catch (err) {
    console.log();
    console.log(chalk.bgRedBright(' ERR '), chalk.red(`Error reading stored credentials.`));

    throw new Error(); 
  }
}

async function storeCredentials(): Promise<void> {
  try {
    await writeFile(
      __AUTH_ID_PATH, 
      CLIENT_ID
    );

    await writeFile(
      __AUTH_SECRET_PATH, 
      CLIENT_SECRET
    );
  }
  catch (err) {
    console.log();
    console.log(chalk.bgRedBright(' ERR '), chalk.red(`Error storing credentials.`));

    throw new Error(); 
  }

  console.log(chalk.magentaBright('  >  '), chalk.magenta('Stored Client Id and Secret.'));
}

async function askCredentials(): Promise<void> {
  CLIENT_ID = await prompter.question(`${chalk.magentaBright('  >  ')}${chalk.magenta('Provide Client Id: ')}`);
  CLIENT_SECRET = await prompter.question(`${chalk.magentaBright('  >  ')}${chalk.magenta('Provide Client Secret: ')}`);
  
  console.log(); 
  const saveCredentialsPrompt = await prompter.question(
    `${chalk.magentaBright('  >  ')}${chalk.magenta('Do you wish to save auth credentials? Not recommended on shared machines. (Y/n): ')}`
  );

  if (saveCredentialsPrompt.toLowerCase() === 'n') return; 

  await storeCredentials(); 
}

async function getCredentials(): Promise<void> {
  if (
    (await Promise.all([
      exists(__AUTH_ID_PATH),
      exists(__AUTH_SECRET_PATH)
    ])).every(e => !!e)
  ) {
    await readStoredCredentials(); 
  }
  else {
    await askCredentials(); 
  }  
}

async function requestToken(): Promise<TokenInfo> {
  console.log(); 
  console.log(chalk.bgCyanBright(' GET '), chalk.cyan(`Attempting to retrieve token with provided client Id and Secret.`));

  const response = await fetch(
    API_OAuth_URI,
    {
      method: 'POST',
      headers: API_OAuth_HEADERS,
      body: new URLSearchParams(API_OAuth_DATA())
    }
  );

  if (!response.ok) {
    console.log();
    console.log(chalk.bgRedBright(' ERR '), chalk.red(`Error requesting token. Response status:`));
    console.log(chalk.bgRedBright(` ${chalk.redBright(response.status)} `), chalk.red(`${response.statusText}`));
    
    throw new Error();
  }

  const tokenInfo: TokenInfo = await response.json() as TokenInfo;
  
  console.log(chalk.bgCyanBright(' GET '), chalk.cyan(`Received access token from OAuth: \`${chalk.cyanBright(tokenInfo.access_token)}\``));

  return tokenInfo; 
}

async function getClipFilesList(): Promise<ClipFile[]> {
  const dirEntries = await readdir(__dirname, { withFileTypes: true }); 
  const clipFilesList: ClipFile[] = []; 

  for (const entry of dirEntries) {
    if (!entry.isFile || !entry.name.endsWith('.mp4')) continue; 
    
    const clipIdMatch = entry.name.match(/(\d{8})_(.*)_source/); 
    if (!clipIdMatch) continue; 

    // Check ES2020 type of match for documentation, 0 is first match (always present), index is group match number
    const clipId = clipIdMatch[2]; 
    if (!clipId) {
      console.log();
      console.log(chalk.bgRedBright(' ERR '), chalk.red(`Error reading entry: \`${chalk.redBright(entry.parentPath, entry.name)}\``));
      console.log(chalk.bgRedBright(' ERR '), chalk.red(`Clip Id cannot be parsed from filename.`));
    }
  
    clipFilesList.push({
      id: clipId,
      path: join(entry.parentPath, entry.name)
    }); 
  }

  console.log();
  console.log(chalk.magentaBright('  >  '), chalk.magenta(`Found ${chalk.magentaBright(clipFilesList.length)} clips.`));

  return clipFilesList; 
}

async function requestClipInfo(clipFiles: ClipFile[]): Promise<ClipInfo[]> {
  if (!clipFiles.length) return []; 

  console.log();
  console.log(chalk.bgCyanBright(' GET '), chalk.cyan(`Requesting clips info ...`));

  const response = await fetch(
    `${API_GetClips_URI}?${new URLSearchParams(clipFiles.map(clip => ['id', clip.id] as [string, string])).toString()}`,
    {
      method: 'GET',
      headers: API_GetClips_HEADERS()
    }
  );

  if (!response.ok) {
    console.log();
    console.log(chalk.bgRedBright(' ERR '), chalk.red(`Error requesting clip info. Response status:`));
    console.log(chalk.bgRedBright(` ${chalk.redBright(response.status)} `), chalk.red(`${response.statusText}`));
    
    throw new Error();
  }

  const clipInfoResponse: ClipInfoResponse = await response.json() as ClipInfoResponse;
  
  console.log(chalk.bgCyanBright(' GET '), chalk.cyan(`Received clip info from API.`));

  return clipInfoResponse.data; 
}


async function renameClip(clipFile: ClipFile, clipInfo: ClipInfo): Promise<void> {
  const date = new Date(clipInfo.created_at); 
  const dateFormatted = `
    ${date.getFullYear().toString().padStart(4, '0')}-${date.getMonth().toString().padStart(2, '0')}-${date.getDay().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}.${date.getMinutes().toString().padStart(2, '0')}
  `.trim(); 

  const timestampedName: string = `${dateFormatted} - ${clipInfo.title}.mp4`; 

  const logEntry: string = `\n\t- ${basename(clipFile.path)}\n\t=> ${timestampedName}`; 
  console.log(chalk.magenta(`${logEntry}`));

  await rename(
    clipFile.path,
    join(
      dirname(clipFile.path),
      timestampedName
    )
  ); 

  await appendFile(__RENAME_LOG, logEntry); 
}

async function renameAllClips(clipFilesList: ClipFile[], clipInfoList: ClipInfo[]): Promise<void> {
  console.log(); 
  console.log(chalk.magentaBright('  >  '), chalk.magenta(`Begin batch renaming clips.`));

  await appendFile(__RENAME_LOG, `\n\n>> START ${(new Date()).toString()}`); 

  for (const clipFile of clipFilesList) {
    const clipInfo = clipInfoList.find(info => clipFile.id === info.id); 
    if (!clipInfo) {
      console.log();
      console.log(chalk.bgRedBright(' ERR '), chalk.red(`Consistency check failed for clip id: \`${chalk.redBright(clipFile.id)}\`.`));
      console.log(chalk.bgRedBright(' ERR '), chalk.red(`Clip not found in requested info list.`));
      console.log(chalk.bgRedBright(' ERR '), chalk.red(`Debug information available in \`${chalk.redBright(__DEBUG_LOG)}\`.`));
      
      try {
        await writeFile(
          __DEBUG_LOG, 
          `
            clipFilesList: 
              ${clipFilesList}

            
            clipInfoList: 
              ${clipInfoList}
          `
        ); 
      }
      catch (err) { }

      throw new Error(); 
    }    
    
    await renameClip(clipFile, clipInfo); 
  }

  console.log(); 
  console.log(chalk.magentaBright('  >  '), chalk.magenta(`Finished batch renaming clips.`));

  await appendFile(__RENAME_LOG, `\n\n>> END ${(new Date()).toString()}`); 
}


const prompter = readline.createInterface(stdin, stdout);

console.log();
console.log(chalk.bgMagentaBright('   TTV Clip Timestamper   '));
console.log();
console.log(); 

await getCredentials(); 

CLIENT_TOKEN = (await requestToken()).access_token; 

const clipFilesList: ClipFile[] = await getClipFilesList(); 
const clipInfoList: ClipInfo[] = await requestClipInfo(clipFilesList); 

await renameAllClips(clipFilesList, clipInfoList); 


await prompter.question(''); 
exit(0); 
