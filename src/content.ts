const CLIENT_ID = '902e93fb13544734b7e97a7903c702b5';
const CLIENT_SECRET = 'de1ef3466023492d9010ae30d0a257f9';

const DEBOUNCE_MS = 1500;
const AUTH_STORAGE_KEY = 'spotify-track-features-authorization';
const LOGGING_PREFIX = 'spotify-track-features:';

// from https://en.wikipedia.org/wiki/Pitch_class
const pitchMap = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

function log(...data: any) {
  console.log(LOGGING_PREFIX, ...data);
}

interface Authorization {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AudioFeatures {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  id: string;
  uri: string;
  track_href: string;
  analysis_url: string;
  duration_ms: number;
  time_signature: number;
}

async function getAuthorization(refresh = false) {
  if (!refresh) {
    const storedAuthInfo = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuthInfo) {
      log('trying stored auth');
      const authInfo: Authorization = JSON.parse(storedAuthInfo);
      return authInfo;
    }
  }

  log('getting new auth');
  const res = await window.fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(CLIENT_ID + ':' + CLIENT_SECRET)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const authInfo: Authorization = await res.json();

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authInfo));

  return authInfo;
}

async function callWithAuth(
  func: (accessToken: string) => Promise<Response>
): Promise<Response> {
  const authInfo1 = await getAuthorization();
  const res1 = await func(authInfo1.access_token);

  if (res1.status !== 401) return res1;

  const authInfo2 = await getAuthorization(true);
  const res2 = await func(authInfo2.access_token);
  // if there's a failure on second try, caller should handle it
  return res2;
}

function addLabel(node: HTMLElement, label: string) {
  if (!node) return;

  if (node.children.length > 0) {
    addLabel(node.children[0] as HTMLElement, label);
  } else {
    node.innerHTML = `${node.innerHTML} <span style="text-decoration: underline;">(${label})</span>`;
  }
}

async function getAndAddLabels(nodes: HTMLAnchorElement[]) {
  log('adding labels!');

  const nodeMap: {
    [key: string]: HTMLAnchorElement;
  } = {};

  nodes.forEach((element) => {
    const matches = element.getAttribute('href')?.match(/\/[^/]*$/);
    if (!matches || matches.length !== 1) return;
    nodeMap[matches[0].substring(1)] = element;
  });

  const res = await callWithAuth((accessToken) =>
    window.fetch(
      `https://api.spotify.com/v1/audio-features?ids=${encodeURIComponent(
        Object.keys(nodeMap).join(',')
      )}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
  );

  if (res.status !== 200) throw new Error('cannot fetch audio features');

  const batchResponse: {
    audio_features: AudioFeatures[];
  } = await res.json();

  batchResponse.audio_features.forEach((features) => {
    const pitch = pitchMap[features.key];
    const tempo = features.tempo.toFixed(2);

    const featureString = `${pitch} - ${tempo}bpm`;
    addLabel(nodeMap[features.id], featureString);
  });
}

async function main() {
  let nodesToBatch: HTMLAnchorElement[] = [];
  let timeout: number | null = null;

  const handleFoundNode = (node: HTMLAnchorElement) => {
    nodesToBatch.push(node);

    if (timeout) window.clearTimeout(timeout);

    timeout = window.setTimeout(async () => {
      const batch = [...nodesToBatch];
      nodesToBatch = [];

      const existingNodes = batch.filter((node) =>
        document.body.contains(node)
      );

      getAndAddLabels(existingNodes);
    }, DEBOUNCE_MS);
  };

  const recurseNodes = (node: Node) => {
    if (node.nodeName.toLowerCase() === 'a') {
      const element = node as HTMLAnchorElement;

      const attr = element.getAttribute('href');
      if (!(attr && attr.startsWith('/track/'))) return;

      setTimeout(() => {
        if (element.dataset.trackFeaturesAdding) return;
        element.dataset.trackFeaturesAdding = 'true';

        handleFoundNode(element);
      }, 100);
    }

    node.childNodes.forEach(recurseNodes);
  };

  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(recurseNodes);
    });
  });

  mutationObserver.observe(document.querySelector('body')!, {
    childList: true,
    subtree: true,
  });
}

main().catch((err) => console.error(LOGGING_PREFIX, err));
