// fetchRanks.ts

import { RateLimiter } from "limiter";

const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 'second' });

export interface IRankInfo {
    tag: string;
    code: string;
    rank: string;
    elo: number;
    wins: number;
    losses: number;
    character: string;
    yesterdayElo?: number;
    rankChange?: string;
}

export async function getRanks(players: string[]): Promise<IRankInfo[]> {
    return (await Promise.all(players.map(getRankInfo)))
        .filter((rankInfo => rankInfo.wins + rankInfo.losses >= 5)).sort((a, b) => b.elo - a.elo);
};

async function getRankInfo(code: string): Promise<IRankInfo> {
    const requestOptions = {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "operationName": "AccountManagementPageQuery",
            "variables": { "cc": code, "uid": code },
            "query": "fragment userProfilePage on User {\n  fbUid\n  displayName\n  connectCode {\n    code\n    __typename\n  }\n  status\n  activeSubscription {\n    level\n    hasGiftSub\n    __typename\n  }\n  rankedNetplayProfile {\n    id\n    ratingOrdinal\n    ratingUpdateCount\n    wins\n    losses\n    dailyGlobalPlacement\n    dailyRegionalPlacement\n    continent\n    characters {\n      id\n      character\n      gameCount\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nquery AccountManagementPageQuery($cc: String!, $uid: String!) {\n  getUser(fbUid: $uid) {\n    ...userProfilePage\n    __typename\n  }\n  getConnectCode(code: $cc) {\n    user {\n      ...userProfilePage\n      __typename\n    }\n    __typename\n  }\n}\n"
        }),
    };
    await limiter.removeTokens(1);
    const data = await (await fetch("https://gql-gateway-dot-slippi.uc.r.appspot.com/graphql", requestOptions)).json();

    const elo = data.data.getConnectCode.user.rankedNetplayProfile.ratingOrdinal;
    // Get most played character
    let character: string;
    if (code === "FUDG#228") {
        character = "FUDGE";
    } else {
        const characters = data.data.getConnectCode.user.rankedNetplayProfile.characters;
        if (characters.length === 0) {
            character = "";
        } else {
            character = characters.reduce((mostCommon: any, current: any) => {
                return current.gameCount > mostCommon.gameCount ? current : mostCommon;
            }).character;
        }
    }

    return {
        tag: data.data.getConnectCode.user.displayName,
        code,
        rank: convertElo(elo),
        elo,
        wins: data.data.getConnectCode.user.rankedNetplayProfile.wins ?? 0,
        losses: data.data.getConnectCode.user.rankedNetplayProfile.losses ?? 0,
        character,
    };
};

function convertElo(elo: number): string {
    if (elo < 765.43) return "Bronze 1";
    if (elo < 913.72) return "Bronze 2";
    if (elo < 1054.87) return "Bronze 3";
    if (elo < 1188.88) return "Silver 1";
    if (elo < 1315.75) return "Silver 2";
    if (elo < 1435.48) return "Silver 3";
    if (elo < 1548.07) return "Gold 1";
    if (elo < 1653.52) return "Gold 2";
    if (elo < 1751.83) return "Gold 3";
    if (elo < 1843) return "Platinum 1";
    if (elo < 1927.03) return "Platinum 2";
    if (elo < 2003.92) return "Platinum 3";
    if (elo < 2073.67) return "Diamond 1";
    if (elo < 2136.28) return "Diamond 2";
    if (elo < 2191.75) return "Diamond 3";
    // TODO: How do master ranks work exactly?
    // if (elo < 2275) return "Master 1";
    // if (elo < 2350) return "Master 2";
    return "Grandmaster";
};
