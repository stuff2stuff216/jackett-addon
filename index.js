require("dotenv").config();
const parseTorrent = require("parse-torrent");
const express = require("express");
const app = express();
const fetch = require("node-fetch");
// var WebTorrent = require("webtorrent");
var torrentStream = require("torrent-stream");

const bodyParser = require("body-parser");

function getSize(size) {
  var gb = 1024 * 1024 * 1024;
  var mb = 1024 * 1024;

  return (
    "💾 " +
    (size / gb > 1
      ? `${(size / gb).toFixed(2)} GB`
      : `${(size / mb).toFixed(2)} MB`)
  );
}

function getQuality(name) {
  if (!name) {
    return name;
  }
  name = name.toLowerCase();

  if (["2160", "4k", "uhd"].filter((x) => name.includes(x)).length > 0)
    return "🌟4k";
  if (["1080", "fhd"].filter((x) => name.includes(x)).length > 0)
    return " 🎥FHD";
  if (["720", "hd"].filter((x) => name.includes(x)).length > 0) return "📺HD";
  if (["480p", "380p", "sd"].filter((x) => name.includes(x)).length > 0)
    return "📱SD";
  return "";
}

// ----------------------------------------------

let isVideo = (element) => {
  return (
    element["name"]?.toLowerCase()?.includes(`.mkv`) ||
    element["name"]?.toLowerCase()?.includes(`.mp4`) ||
    element["name"]?.toLowerCase()?.includes(`.avi`) ||
    element["name"]?.toLowerCase()?.includes(`.flv`)
  );
};

// ----------------------------------------------

const toStream = async (
  parsed,
  uri,
  tor,
  type,
  s,
  e,
  abs_season,
  abs_episode,
  abs
) => {
  const infoHash = parsed.infoHash.toLowerCase();
  let title = tor.extraTag || parsed.name;
  let index = -1;

  if (!parsed.files && uri.startsWith("magnet")) {
    var engine = torrentStream("magnet:" + uri, { connections: 10 });
    let res = await new Promise((resolve, reject) => {
      engine.on("ready", function () {
        resolve(engine.files);
      });

      //
      setTimeout(() => {
        resolve([]);
      }, 20000); // Too slooooow, the server is too slow
    });

    parsed.files = res;
    engine.destroy();
  }

  // console.log({ name: parsed?.name });
  // console.log({ size: parsed?.files?.length });

  if (media == "series") {
    index = (parsed.files ?? []).findIndex((element, index) => {
      // console.log({ element: element["name"] });

      if (!element["name"]) {
        return false;
      }

      let containEandS = (element) =>
        //SxxExx
        //Sxx - Exx
        //Sxx.Exx
        //Season xx Exx
        //SasEae selon abs
        //SasEaex  selon abs
        //SasEaexx  selon abs
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")}e${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")} - e${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")}.e${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s}${e?.padStart(2, "0")}`) ||
        element["name"]?.toLowerCase()?.includes(`s${s}e${e}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")}e${e}`) ||
        element["name"]?.toLowerCase()?.includes(`season ${s} e${e}`) ||
        (abs &&
          (element["name"]
            ?.toLowerCase()
            ?.includes(
              `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(
                2,
                "0"
              )}`
            ) ||
            element["name"]
              ?.toLowerCase()
              ?.includes(
                `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(
                  3,
                  "0"
                )}`
              ) ||
            element["name"]
              ?.toLowerCase()
              ?.includes(
                `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(
                  4,
                  "0"
                )}`
              )));

      let containE_S = (element) =>
        //Sxx - xx
        //Sx - xx
        //Sx - x
        //Season x - x
        //Season x - xx
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")} - ${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s} - ${e?.padStart(2, "0")}`) ||
        element["name"]?.toLowerCase()?.includes(`s${s} - ${e}`) ||
        element["name"]?.toLowerCase()?.includes(`season ${s} - ${e}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`season ${s} - ${e?.padStart(2, "0")}`);

      let containsAbsoluteE = (element) =>
        //- xx
        //- xxx
        //- xxxx
        //- 0x
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(2, "0")} `) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(3, "0")} `) ||
        element["name"]?.toLowerCase()?.includes(` 0${abs_episode} `) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(4, "0")} `);

      let containsAbsoluteE_ = (element) =>
        // xx.
        // xxx.
        // xxxx.
        // 0x.
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(2, "0")}.`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(3, "0")}.`) ||
        element["name"]?.toLowerCase()?.includes(` 0${abs_episode}.`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(4, "0")}.`);

      return (
        isVideo(element) &&
        (containEandS(element) ||
          containE_S(element) ||
          (((abs && containsAbsoluteE(element)) ||
            (abs && containsAbsoluteE_(element))) &&
            !(
              element["name"]?.toLowerCase()?.includes("s0") ||
              element["name"]?.toLowerCase()?.includes(`s${abs_season}`) ||
              element["name"]?.toLowerCase()?.includes("e0") ||
              element["name"]?.toLowerCase()?.includes(`e${abs_episode}`) ||
              element["name"]?.toLowerCase()?.includes("season")
            )))
      );
    });
    //
    if (index == -1) {
      return null;
    }

    title = !!title ? title + "\n" + parsed.files[index]["name"] : null;

    // console.log({ title });
  }

  if (media == "movie") {
    index = (parsed?.files ?? []).findIndex((element, index) => {
      // console.log({ element: element["name"] });
      return isVideo(element);
    });
    //
    if (index == -1) {
      return null;
    }
  }
  // console.log(parsed.files[index]["name"]);

  title = title ?? parsed.files[index]["name"];

  //console.log({ title });

  title += "\n" + getQuality(title);

  const subtitle = "S:" + tor["Seeders"] + " | P:" + tor["Peers"];
  title += ` | ${
    index == -1 || parsed.files == []
      ? `${getSize(0)}`
      : `${getSize(parsed.files[index]["length"] ?? 0)}`
  } | ${subtitle} `;

  // console.log({ title });

  return {
    name: tor["Tracker"],
    type: type,
    infoHash: infoHash,
    fileIdx: index == -1 ? 0 : index,
    sources: (parsed.announce || [])
      .map((x) => {
        return "tracker:" + x;
      })
      .concat(["dht:" + infoHash]),
    title: title,
    behaviorHints: {
      bingeGroup: `Jackett-Addon|${infoHash}`,
      notWebReady: true,
    },
  };
};

let isRedirect = async (url) => {
  try {
    const controller = new AbortController();
    // 5 second timeout:
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 301 || response.status === 302) {
      const locationURL = new URL(
        response.headers.get("location"),
        response.url
      );
      if (locationURL.href.startsWith("http")) {
        await isRedirect(locationURL);
      } else {
        return locationURL.href;
      }
    } else if (response.status >= 200 && response.status < 300) {
      return response.url;
    } else {
      // return response.url;
      return null;
    }
  } catch (error) {
    // console.log({ error });
    return null;
  }
};

const streamFromMagnet = (
  tor,
  uri,
  type,
  s,
  e,
  abs_season,
  abs_episode,
  abs
) => {
  return new Promise(async (resolve, reject) => {
    //follow redirection cause some http url sent magnet url
    let realUrl = uri?.startsWith("magnet:?") ? uri : await isRedirect(uri);

    if (realUrl) {
      // console.log({ realUrl });
      if (realUrl?.startsWith("magnet:?")) {
        resolve(
          toStream(
            parseTorrent(realUrl),
            realUrl,
            tor,
            type,
            s,
            e,
            abs_season,
            abs_episode,
            abs
          )
        );
      } else if (realUrl?.startsWith("http")) {
        parseTorrent.remote(realUrl, (err, parsed) => {
          if (!err) {
            resolve(
              toStream(
                parsed,
                realUrl,
                tor,
                type,
                s,
                e,
                abs_season,
                abs_episode,
                abs
              )
            );
          } else {
            // console.log("err parsing http");
            resolve(null);
          }
        });
      } else {
        // console.log("no http nor magnet");
        resolve(realUrl);
      }
    } else {
      // console.log("no real uri");
      resolve(null);
    }
  });
};

let stream_results = [];
let torrent_results = [];

const host = "http://1.156.186.156:9117";
const apiKey = "lfc52616kbv1ziq9iyidtyzccjgjfvqf";

let fetchTorrent = async (query) => {
  // let url = `${host}/api/v2.0/indexers/all/results?apikey=${apiKey}&Category%5B%5D=2000&Category%5B%5D=5000&Query=${query}&Tracker%5B%5D=kickasstorrents-ws&Tracker%5B%5D=thepiratebay`;

  let url = `${host}/api/v2.0/indexers/all/results?apikey=${apiKey}&Query=${query}&Category%5B%5D=2000&Category%5B%5D=5000&Tracker%5B%5D=kickasstorrents-ws&Tracker%5B%5D=thepiratebay&Tracker%5B%5D=torrent9`;
  // console.log({ query });
  return await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "x-requested-with": "XMLHttpRequest",
      cookie:
        "Jackett=CfDJ8AG_XUDhxS5AsRKz0FldsDJIHUJANrfynyi54VzmYuhr5Ha5Uaww2hSQytMR8fFWjPvDH2lKCzaQhRYI9RuK613PZxJWz2tgHqg1wUAcPTMfi8b_8rm1Igw1-sZB_MnimHHK7ZSP7HfkWicMDaJ4bFGZwUf0xJOwcgjrwcUcFzzsVSTALt97-ibhc7PUn97v5AICX2_jsd6khO8TZosaPFt0cXNgNofimAkr5l6yMUjShg7R3TpVtJ1KxD8_0_OyBjR1mwtcxofJam2aZeFqVRxluD5hnzdyxOWrMRLSGzMPMKiaPXNCsxWy_yQhZhE66U_bVFadrsEeQqqaWb3LIFA",
    },
    referrerPolicy: "no-referrer",
    // body: null,
    method: "GET",
  })
    .then((res) => res.json())
    .then(async (results) => {
      console.log({ Initial: results["Results"]?.length });
      // console.log({ Response: results["Results"] });
      if (results["Results"].length != 0) {
        torrent_results = await Promise.all(
          results["Results"].map((result) => {
            return new Promise((resolve, reject) => {
              resolve({
                Tracker: result["Tracker"],
                Category: result["CategoryDesc"],
                Title: result["Title"],
                Seeders: result["Seeders"],
                Peers: result["Peers"],
                Link: result["Link"],
                MagnetUri: result["MagnetUri"],
              });
            });
          })
        );
        return torrent_results;
      } else {
        return [];
      }
    });
};

function getMeta(id, type) {
  var [tt, s, e] = id.split(":");

  return fetch(`https://v2.sg.media-imdb.com/suggestion/t/${tt}.json`)
    .then((res) => res.json())
    .then((json) => {
      return json.d[0];
    })
    .then(({ l, y }) => ({ name: l, year: y }))
    .catch((err) =>
      fetch(`https://v3-cinemeta.strem.io/meta/${type}/${tt}.json`)
        .then((res) => res.json())
        .then((json) => json.meta)
    );
}

async function getImdbFromKitsu(id) {
  var [kitsu, _id, e] = id.split(":");

  return fetch(`https://anime-kitsu.strem.fun/meta/anime/${kitsu}:${_id}.json`)
    .then((_res) => _res.json())
    .then((json) => {
      return json["meta"];
    })
    .then((json) => {
      try {
        let imdb = json["imdb_id"];
        let meta = json["videos"].find((el) => el.id == id);
        return [
          imdb,
          (meta["imdbSeason"] ?? 1).toString(),
          (meta["imdbEpisode"] ?? 1).toString(),
          (meta["season"] ?? 1).toString(),
          (meta["imdbSeason"] ?? 1).toString() == 1
            ? (meta["imdbEpisode"] ?? 1).toString()
            : (meta["episode"] ?? 1).toString(),
          meta["imdbEpisode"] != meta["episode"] || meta["imdbSeason"] == 1,
        ];
      } catch (error) {
        return null;
      }
    })
    .catch((err) => null);
}

app
  .get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    var json = {
      id: "daiki.jackettpb.stream",
      version: "1.0.1",
      name: "Jackett for PB, Kkass,...",
      description: "Movie & TV Streams from Jackett ",
      logo: "https://raw.githubusercontent.com/daniwalter001/daniwalter001/main/52852137.png",
      resources: [
        {
          name: "stream",
          types: ["movie", "series"],
          idPrefixes: ["tt", "kitsu"],
        },
      ],
      types: ["movie", "series", "anime", "other"],
      catalogs: [],
    };

    return res.send(json);
  })
  .get("/stream/:type/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    media = req.params.type;
    let id = req.params.id;
    id = id.replace(".json", "");

    let tmp = [];

    if (id.includes("kitsu")) {
      tmp = await getImdbFromKitsu(id);
      if (!tmp) {
        return res.send({ stream: {} });
      }
    } else {
      tmp = id.split(":");
    }

    let [tt, s, e, abs_season, abs_episode, abs] = tmp;

    console.log(tmp);

    let meta = await getMeta(tt, media);

    console.log({ meta: id });
    console.log({ name: meta?.name, year: meta?.year });

    let query = "";
    query = meta?.name;

    let result = [];

    if (media == "movie") {
      query += " " + meta?.year;
      result = await fetchTorrent(encodeURIComponent(query));
    } else if (media == "series") {
      let promises = [
        fetchTorrent(
          encodeURIComponent(`${query} S${(s ?? "1").padStart(2, "0")}`)
        ),
        fetchTorrent(encodeURIComponent(`${query} S${s ?? "1"}`)),
        fetchTorrent(encodeURIComponent(`${query} Season ${s ?? "1"}`)),
        fetchTorrent(encodeURIComponent(`${query} Complete`)),
      ];

      if (abs) {
        promises.push(
          fetchTorrent(
            encodeURIComponent(`${query} ${abs_episode?.padStart(2, "0")}`)
          )
        );
      }

      result = await Promise.all(promises);

      result = [
        ...result[0],
        ...result[1],
        ...result[2],
        ...result[3],
        ...(result?.length >= 5 ? result[4] : []),
      ];
    }

    result.sort((a, b) => {
      return +a["Peers"] - +b["Peers"];
    });

    result = result?.length >= 15 ? result.splice(-15) : result;
    result.reverse();

    let stream_results = await Promise.all(
      result.map((torrent) => {
        console.log(`${torrent["Title"]} => ${torrent["Peers"]}`);
        if (
          (torrent["MagnetUri"] != "" || torrent["Link"] != "") &&
          torrent["Peers"] >= 1
        ) {
          return streamFromMagnet(
            torrent,
            torrent["MagnetUri"] || torrent["Link"],
            media,
            s,
            e,
            abs_season,
            abs_episode,
            abs
          );
        }
      })
    );

    stream_results = Array.from(new Set(stream_results)).filter((e) => !!e);

    console.log({ Final: stream_results.length });

    return res.send({ streams: stream_results });
  })
  .listen(process.env.PORT || 3000, () => {
    console.log("The server is working on " + process.env.PORT || 3000);
  });
