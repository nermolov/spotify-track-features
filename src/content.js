"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
function log(...data) {
    console.log(LOGGING_PREFIX, ...data);
}
function getAuthorization(refresh = false) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!refresh) {
            const storedAuthInfo = localStorage.getItem(AUTH_STORAGE_KEY);
            if (storedAuthInfo) {
                log('trying stored auth');
                const authInfo = JSON.parse(storedAuthInfo);
                return authInfo;
            }
        }
        log('getting new auth');
        const res = yield window.fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${btoa(CLIENT_ID + ':' + CLIENT_SECRET)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });
        const authInfo = yield res.json();
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authInfo));
        return authInfo;
    });
}
function callWithAuth(func) {
    return __awaiter(this, void 0, void 0, function* () {
        const authInfo1 = yield getAuthorization();
        const res1 = yield func(authInfo1.access_token);
        if (res1.status !== 401)
            return res1;
        const authInfo2 = yield getAuthorization(true);
        const res2 = yield func(authInfo2.access_token);
        // if there's a failure on second try, caller should handle it
        return res2;
    });
}
function addLabel(node, label) {
    if (!node)
        return;
    if (node.children.length > 0) {
        addLabel(node.children[0], label);
    }
    else {
        node.innerHTML = `${node.innerHTML} <span style="text-decoration: underline;">(${label})</span>`;
    }
}
function getAndAddLabels(nodes) {
    return __awaiter(this, void 0, void 0, function* () {
        log('adding labels!');
        const nodeMap = {};
        nodes.forEach((element) => {
            var _a;
            const matches = (_a = element.getAttribute('href')) === null || _a === void 0 ? void 0 : _a.match(/\/[^/]*$/);
            if (!matches || matches.length !== 1)
                return;
            nodeMap[matches[0].substring(1)] = element;
        });
        const res = yield callWithAuth((accessToken) => window.fetch(`https://api.spotify.com/v1/audio-features?ids=${encodeURIComponent(Object.keys(nodeMap).join(','))}`, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        }));
        if (res.status !== 200)
            throw new Error('cannot fetch audio features');
        const batchResponse = yield res.json();
        batchResponse.audio_features.forEach((features) => {
            const pitch = pitchMap[features.key];
            const tempo = features.tempo.toFixed(2);
            const featureString = `${pitch} - ${tempo}bpm`;
            addLabel(nodeMap[features.id], featureString);
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let nodesToBatch = [];
        let timeout = null;
        const handleFoundNode = (node) => {
            nodesToBatch.push(node);
            if (timeout)
                window.clearTimeout(timeout);
            timeout = window.setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                const batch = [...nodesToBatch];
                nodesToBatch = [];
                const existingNodes = batch.filter((node) => document.body.contains(node));
                getAndAddLabels(existingNodes);
            }), DEBOUNCE_MS);
        };
        const recurseNodes = (node) => {
            if (node.nodeName.toLowerCase() === 'a') {
                const element = node;
                const attr = element.getAttribute('href');
                if (!(attr && attr.startsWith('/track/')))
                    return;
                setTimeout(() => {
                    if (element.dataset.trackFeaturesAdding)
                        return;
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
        mutationObserver.observe(document.querySelector('body'), {
            childList: true,
            subtree: true,
        });
    });
}
main().catch((err) => console.error(LOGGING_PREFIX, err));
