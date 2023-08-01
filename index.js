require("dotenv").config();
const parseTorrent = require("parse-torrent");
const express = require("express");
const app = express();
const fetch = require("node-fetch");

const bodyParser = require("body-parser");
const cors = require("cors");

const type_ = {
  MOVIE: "movie",
  TV: "series",
};

const toStream = (parsed, tor, type) => {
  const infoHash = parsed.infoHash.toLowerCase();
  let title = tor.extraTag || parsed.name;
  const subtitle = "Seeds: " + tor["Seeders"] + " / Peers: " + tor["Peers"];
  title += (title.indexOf("\n") > -1 ? "\r\n" : "\r\n\r\n") + subtitle;

  // console.log(parsed.files);

  return {
    name: tor["Tracker"],
    type: type,
    infoHash: infoHash,
    sources: (parsed.announce || [])
      .map((x) => {
        return "tracker:" + x;
      })
      .concat(["dht:" + infoHash]),
    title: title,
  };
};

const streamFromMagnet = (tor, uri, type) => {
  return new Promise((resolve, reject) => {
    if (uri.startsWith("magnet:?")) {
      resolve(toStream(parseTorrent(uri), tor, type));
    }
    parseTorrent.remote(uri, (err, parsed) => {
      if (!err) {
        resolve(toStream(parsed, tor, type));
      } else {
        resolve(false);
      }
    });
  });
};

let stream_results = [];
let torrent_results = [];

let host = "http://82.123.61.186:9117";
let apiKey = "h3cotr040alw3lqbuhjgrorcal76bv17";

let fetchTorrent = async (query, season, ep) => {
  let url = `${host}/api/v2.0/indexers/test:passed/results?apikey=${apiKey}&Query=${query}&Category%5B%5D=2000&Category%5B%5D=5000&Tracker%5B%5D=abnormal&Tracker%5B%5D=beyond-hd-api&Tracker%5B%5D=blutopia-api&Tracker%5B%5D=morethantv-api&Tracker%5B%5D=uhdbits&_=1690837706300`;
  return await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "x-requested-with": "XMLHttpRequest",
      cookie:
        "Jackett=CfDJ8I6Mb7LP45FJnvigakrTj74ePZu6V38BUX6bPJhcgU1tEfJrQEBs03y7d5sEdV4E6r6h3yirPu1TmMrG8iq_wCXuNjkHTIA8A5eZaBwr1tRIi73IrBkZZPPKssM-p2odOSxvh3uP7Kq9X0fcyJ0z-NmGqYMj5d-wD44_cXburMbuiqwqMZGV_AWDQiyHqDT3wPHzVlOaJ5waB_slVpKV3QJzpCNSePdp1B1cgj-EdA2T5_QohioaFV_eTeqydYO3u0TnHJDeuRJqpsTF9z05pJlQj5rV3ir3TiVcsfzvpyQlM9Fc3wLXbmCg06n8RF0rprlAG9lCTQ7X_6RNaY1jo4U",
    },
    referrerPolicy: "no-referrer",
    // body: null,
    method: "GET",
  })
    .then((res) => res.json())
    .then(async (results) => {
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

    const [tt, s, e] = id.split(":");
    let query = "";
    let meta = await getMeta(tt, media);
    query = meta?.name;

    if (media == "movie") {
      query += " " + meta?.year;
    } else if (media == "series") {
      query += " S" + (s ?? "1").padStart(2, "0");
    }
    query = encodeURIComponent(query);

    let result = await fetchTorrent(query, s, e);

    let stream_results = await Promise.all(
      result.map((torrent) => {
        return streamFromMagnet(torrent, torrent["Link"], media);
      })
    );

    // console.log(stream_results);

    res.json({ streams: stream_results });
  })
  .listen(process.env.PORT || 3000, () => {
    console.log("The server is working on " + process.env.PORT || 3000);
  });
