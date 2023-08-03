require("dotenv").config();
const parseTorrent = require("parse-torrent");
const express = require("express");
const app = express();
const fetch = require("node-fetch");
// var torrentStream = require("torrent-stream");

const bodyParser = require("body-parser");
const cors = require("cors");

const type_ = {
  MOVIE: "movie",
  TV: "series",
};

const toStream = (parsed, tor, type, s, e) => {
  const infoHash = parsed.infoHash.toLowerCase();
  let title = tor.extraTag || parsed.name;
  let index = -1;
  if (media == "series") {
    index = (parsed.files ?? []).findIndex((element, index) => {
      return (
        element["name"]?.toLowerCase()?.includes(`s0${s}`) &&
        element["name"]?.toLowerCase()?.includes(`e0${e}`) &&
        (element["name"]?.toLowerCase()?.includes(`.mkv`) ||
          element["name"]?.toLowerCase()?.includes(`.mp4`) ||
          element["name"]?.toLowerCase()?.includes(`.avi`) ||
          element["name"]?.toLowerCase()?.includes(`.flv`))
      );
    });

    title += index == -1 ? "" : `\n${parsed.files[index]["name"]}`;
  }

  const subtitle = "Seeds: " + tor["Seeders"] + " / Peers: " + tor["Peers"];
  title += (title.indexOf("\n") > -1 ? "\r\n" : "\r\n\r\n") + subtitle;

  return {
    name: tor["Tracker"],
    type: type,
    infoHash: infoHash,
    fileIdx: index == -1 ? 1 : index,
    sources: (parsed.announce || [])
      .map((x) => {
        return "tracker:" + x;
      })
      .concat(["dht:" + infoHash]),
    title: title,
    behaviorHints: {
      bingeGroup: `Jackett-Addon|${infoHash}`,
      // notWebReady: true,
    },
  };
};

let isRedirect = async (url) => {
  const response = await fetch(url, {
    redirect: "manual",
  });

  if (response.status === 301 || response.status === 302) {
    const locationURL = new URL(response.headers.get("location"), response.url);
    if (locationURL.href.startsWith("http")) {
      await isRedirect(locationURL);
    } else {
      return locationURL.href;
    }
  } else if (response.status >= 200 && response.status < 300) {
    return response.url;
  } else {
    return null;
  }
};

const streamFromMagnet = (tor, uri, type, s, e) => {
  return new Promise(async (resolve, reject) => {
    //follow redirection cause some http url sent magnet url
    let realUrl = uri?.startsWith("magnet:?") ? uri : await isRedirect(uri);

    if (realUrl) {
      if (realUrl?.startsWith("magnet:?")) {
        resolve(toStream(parseTorrent(realUrl), tor, type, s, e));
      } else if (realUrl?.startsWith("http")) {
        parseTorrent.remote(realUrl, (err, parsed) => {
          if (!err) {
            resolve(toStream(parsed, tor, type, s, e));
          } else {
            resolve(null);
          }
        });
      } else {
        resolve(realUrl);
      }
    } else {
      resolve(null);
    }
  });
};

let stream_results = [];
let torrent_results = [];

// let host = "http://82.123.61.186:9117";
// let apiKey = "h3cotr040alw3lqbuhjgrorcal76bv17";

let host = "http://1.202.50.183:9117";
let apiKey = "ht0imkbrces8ypsmskunjr1zj2l9ecf4";

let fetchTorrent = async (query) => {
  let url = `${host}/api/v2.0/indexers/test:passed/results?apikey=${apiKey}&Query=${query}&Category%5B%5D=2000&Category%5B%5D=5000`;

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
      // console.log(results["Results"].length);
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
    .then((json) => json.d[0])
    .then(({ l, y }) => ({ name: l, year: y }))
    .catch((err) =>
      fetch(`https://v3-cinemeta.strem.io/meta/${type}/${tt}.json`)
        .then((res) => res.json())
        .then((json) => json.meta)
    );
}

app
  .get("/manifest.json", (req, res) => {
    var json = {
      id: "mikmc.od.org+++",
      version: "3.0.0",
      name: "Jacket doing his things",
      description: "Movie & TV Streams from Jackett",
      logo: "https://raw.githubusercontent.com/daniwalter001/daniwalter001/main/52852137.png",
      resources: ["stream"],
      types: ["movie", "series"],
      idPrefixes: ["tt"],
      catalogs: [],
    };
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");
    return res.send(json);
  })
  .get("/stream/:type/:id", async (req, res) => {
    media = req.params.type;
    let id = req.params.id;
    id = id.replace(".json", "");

    let [tt, s, e] = id.split(":");
    let query = "";
    let meta = await getMeta(tt, media);

    console.log({ meta: id });
    console.log({ meta });
    query = meta?.name;

    if (media == "movie") {
      query += " " + meta?.year;
    } else if (media == "series") {
      query += " S" + (s ?? "1").padStart(2, "0");
    }
    query = encodeURIComponent(query);

    let result = await fetchTorrent(query);

    let stream_results = await Promise.all(
      result.map((torrent) => {
        if (torrent["Link"] != "" || torrent["MagnetUri"] != "") {
          return streamFromMagnet(
            torrent,
            torrent["Link"] || torrent["MagnetUri"],
            media,
            s,
            e
          );
        }
      })
    );

    stream_results = Array.from(new Set(stream_results));

    // console.log(stream_results);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    // console.log({stream_results})

    return res.send({ streams: stream_results });
  })
  .listen(process.env.PORT || 3000, () => {
    console.log("The server is working on " + process.env.PORT || 3000);
  });
