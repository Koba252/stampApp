const express = require("express");
const app = express();
const db = require("./db/dbinfo");
require('dotenv').config();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const {check, validationResult} = require("express-validator");
const timeout = require("express-timeout-handler");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var options = {
  timeout: 1000 * 15,
  onTimeout: (req, res) => {
    res.status(503).json({
      msg: "Timeout err"
    });
  }
};

app.use(timeout.handler(options));

app.listen(port, () => {
  console.log("Start sever port: " + port);
});

app.set("superSecret", process.env.ENV_SSECRET);
var apiRoutes = express.Router();

// ユーザー登録
app.post("/api/register", [
  check('postUserId').isAlphanumeric(),
  check('postUserId').isLength({min: 8, max: 8}),
  check('postUserPass').isAlphanumeric(),
  check('postUserPass').isLength({min: 8, max: 8})
],(req, res) => {
  console.log("/api/register");
  if (!validationResult(req).isEmpty()) {
    console.log(validationResult(req).array());
    console.log("Invalid user id or password");
    return res.status(422).json({
      token: "-1"
    });
  }
  var users = {
    id: req.body.postUserId,
    pass: req.body.postUserPass
  };
  
  ( async () => {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      var result = await client.query("SELECT id FROM users");
      var target = result.rows.find((item) => {
        return (item.id === users.id);
      });
      if (target != undefined) {
        await client.query("COMMIT");
        console.log("This user id is already used");
        res.json({
          token: "-2"
        });
      } else {
        client.query("INSERT INTO users (id, pass) VALUES ($1, $2)", [users.id, users.pass]);
        var user_id = String(users.id);
        var token = jwt.sign(user_id, app.get("superSecret"));
        await client.query("COMMIT");
        console.log("Registration success");
        return res.json({
        token: token
      });
      }
    } catch (err) {
      console.log("Fail to create account");
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })().catch(err => {
    console.log(err.stack);
    res.json({
      msg: "Fail to create account"
    });
  });
});

// トークン発行、ログイン
apiRoutes.post("/authenticate", (req, res) => {
  console.log("/api/authenticate");
  var users = {
    id: req.body.postUserId,
    pass: req.body.postUserPass
  };
  (async () => {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      var result = await client.query("SELECT id, pass FROM users");
      var users_list = result.rows;
      for (var i = 0; i < users_list.length; i++) {
        if (users.id == users_list[i].id && users.pass == users_list[i].pass) {
          var user_id = String(users.id);
          var token = jwt.sign(user_id, app.get("superSecret"));
          await client.query("COMMIT");
          console.log("Authentication success");
          return res.json({
            token: token
          });
        }
      }
      await client.query("COMMIT");
      console.log("Invalid user id or password");
      res.json({
        token: "-1"
      });
    } catch (err) {
      console.log("Fail to authenticate");
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })().catch(err => {
    console.log(err.stack);
    res.json({
      msg: "Fail to authenticate"
    });
  })
});

// 認証チェック
apiRoutes.use((req, res, next) => {
  var token = req.body.token;
  if (!token) {
    res.json({
      errNum: "99",
      msg: "No token provided"
    });
  }
  jwt.verify(token, app.get("superSecret"), (err, decoded) => {
    if (err) {
      console.log(err);
      return res.json({
        errNum: "99",
        msg: "Invalid token"
      });
    }
    req.decoded;
    next();
  });
});

// 認証後の接続確認
apiRoutes.get("/test", (req, res) => {
  console.log("/api/test");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  console.log(decoded.payload);
  res.json({
    msg: "Hello authenticated world"
  });
});

// 所持カード一覧取得
apiRoutes.post("/list", (req, res) => {
  console.log("/api/list");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  var user_id = decoded.payload;
  console.log(user_id);
  (async () => {
    const client = await db.pool.connect();

    try {
      var card_ary = [];
      var result;
      await client.query("BEGIN");
      result = await client.query("SELECT fk_card_id, point FROM possessions WHERE fk_user_id = $1 ORDER BY fk_card_id", [user_id]);
      if (result.rows[0] == null) {
        var card_ary_none = [{
          name: "",
          img: "",
          info: "",
          id: "",
          point: ""
        }];
        await client.query("COMMIT");
        console.log(card_ary_none);
        console.log("success!");
        res.json({
          cardAry: card_ary_none
        });
      } else {
        for (var i = 0; i < result.rows.length; i++) {
          card_ary.push({id: result.rows[i].fk_card_id, point: result.rows[i].point});
        }
        var slct = "id =" + card_ary[0].id;
        for (var i = 1; i < card_ary.length; i++) {
          slct += " OR id = " + card_ary[i].id;
        }
        result = await client.query("SELECT name, img, info FROM cards WHERE " + slct + " ORDER BY id");
        for (var i = 0; i < card_ary.length; i++) {
          card_ary[i].name = result.rows[i].name;
          card_ary[i].img = String(result.rows[i].img);
          card_ary[i].info = result.rows[i].info;
          card_ary[i].id = String(card_ary[i].id);
          card_ary[i].point = String(card_ary[i].point);
        }
        await client.query("COMMIT");
        console.log(card_ary);
        console.log("success!");
        res.json({
          cardAry: card_ary
        });
      }
    } catch (err) {
      console.log("Fail to get possessing cards");
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })().catch(err => {
    console.log(err.stack);
    return res.json({
      msg: "Fail to get possessing cards"
    });
  });
});

// 作成カード一覧取得

apiRoutes.post("/works", (req, res) => {
  console.log("/api/works");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  var user_id = decoded.payload;
  console.log(user_id);
  (async () => {
    const client = await db.pool.connect();
    try {
      var created_cards = [];
      var result;
      await client.query("BEGIN");
      result = await client.query("SELECT fk_card_id FROM admins WHERE fk_user_id = $1 ORDER BY fk_card_id", [user_id]);
      if (result.rows[0] == null) {
        var created_cards_none = [{
          id: "",
          name: "",
          img: "",
          info: "",
          url: ""
        }];
        await client.query("COMMIT");
        console.log(created_cards_none);
        console.log("success!");
        res.json({
          createdCards: created_cards_none
        });
      } else {
        for (var i = 0; i < result.rows.length; i++) {
          created_cards.push({id: String(result.rows[i].fk_card_id)});
        }
        var slct = "id =" + created_cards[0].id;
        for (var i = 1; i < created_cards.length; i++) {
          slct += " OR id = " + created_cards[i].id;
        }
        result = await client.query("SELECT name, img, info, url FROM cards WHERE " + slct + " ORDER BY id");
        for (var i = 0; i < result.rows.length; i++) {
          created_cards[i].name = result.rows[i].name;
          created_cards[i].img = String(result.rows[i].img);
          created_cards[i].info = result.rows[i].info;
          created_cards[i].url = String(result.rows[i].url);
        }
        await client.query("COMMIT");
        console.log(created_cards);
        console.log("success!");
        res.json({
          createdCards: created_cards
        });
      }
    } catch (err) {
      console.log("Fail to get created cards");
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })().catch(err => {
    console.log(err.stack);
    return res.json({
      msg: "Fail to get created cards"
    });
  });
});

// 作成
apiRoutes.post("/create", (req, res) => {
  console.log("/api/create");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  var user_id = decoded.payload;
  var card_url = Math.round(Math.random() * 10000);
  var cards = {
    name: req.body.postCardName,
    img: req.body.postCardImg,
    info: req.body.postCardInfo,
    url: card_url
  }
  console.log(user_id);
  console.log(cards);
  if (cards.name == null || cards.img == null || cards.info == null || cards.name == "" || cards.img == "" || cards.info == "") {
    console.log("Card name or img or info is null");
    return res.json({
      cardName: "Card name or img or info is null",
      cardImg: "",
      cardInfo: "",
      cardUrl : "",
      cardId: ""
    });
  }
  ( async () => {
    const client = await db.pool.connect();
    try {
      var result;
      await client.query("BEGIN");
      result = await client.query("SELECT MAX(id) FROM cards");
      var prvs_card_id = result.rows[0].max;
      cards.url = "" + prvs_card_id + cards.url + prvs_card_id;
      Number(cards.url);
      console.log(cards.url);
      client.query("INSERT INTO cards (name, img, info, url) VALUES ($1, $2, $3, $4)", [cards.name, cards.img, cards.info, cards.url]);
      var new_card_id = prvs_card_id + 1;
      client.query("INSERT INTO admins (fk_user_id, fk_card_id) VALUES ($1, $2)", [user_id, new_card_id]);
      cards.url = String(cards.url);
      new_card_id = String(new_card_id);
      await client.query("COMMIT");
      console.log("success!");
      res.json({
        cardName: cards.name,
        cardImg: cards.img,
        cardInfo: cards.info,
        cardUrl : cards.url,
        cardId: new_card_id
      });
    } catch (err) {
      console.log("Fail to create card")
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })().catch(err => {
    console.log(err.stack);
    res.json({
      msg: "Fail to create card"
    });
  });
});

// 編集
apiRoutes.post("/edit", (req, res) => {
  console.log("/api/edit");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  var user_id = decoded.payload;
  var cards = {
    id: req.body.postCardId,
    name: req.body.postCardName,
    img: req.body.postCardImg,
    info: req.body.postCardInfo
  }
  console.log(user_id);
  console.log(cards);
  if (cards.name == null || cards.img == null || cards.info == null || cards.name == "" || cards.img == "" || cards.info == "") {
    console.log("Card name or img or info is null");
    return res.json({
      cardName: "Card name or img or info is null",
      cardImg: "",
      cardInfo: "",
      cardUrl : "",
      cardId: ""
    });
  }
  ( async () => {
    const client = await db.pool.connect();
    try {
      var result;
      await client.query("BEGIN");
      result = await client.query("SELECT fk_user_id FROM admins WHERE fk_card_id = $1", [cards.id]);
      var target = result.rows.find((item) => {
        return (item.fk_user_id === user_id)
      });
      console.log(target);
      if (target == undefined) {
        await client.query("COMMIT");
        console.log("This user do not have control of this card");
        res.json({
          msg: "This user do not have control of this card"
        });
      } else {
        client.query("UPDATE cards SET name = $1, img = $2, info = $3 WHERE id = $4", [cards.name, cards.img, cards.info, cards.id]);
        cards.id = String(cards.id);
        cards.img = String(cards.img);
        await client.query("COMMIT");
        console.log("success!");
        res.json({
          cardId: cards.id,
          cardName: cards.name,
          cardImg: cards.img,
          cardInfo: cards.info
        });
      }
    } catch (err) {
      console.log("Fail to edit card");
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })().catch(err => {
    console.log(err.stack);
    res.json({
      msg: "Fail to edit card"
    });
  });
});

// ポイント付与
apiRoutes.post("/add", (req, res) => {
  console.log("api/add");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  var user_id = decoded.payload;
  var url_num = req.body.postUrlNum;
  console.log(user_id);
  console.log(url_num);
  ( async () => {
    const client = await db.pool.connect();
    try {
      var result;
      await client.query("BEGIN");
      result = await client.query("SELECT id FROM cards WHERE url = $1", [url_num]);
      var card_id = result.rows[0].id;
      result = await client.query("SELECT fk_card_id FROM possessions WHERE fk_user_id = $1", [user_id]);
      var target = result.rows.find((item) => {
        return (item.fk_card_id === card_id);
      });
      if (target == undefined) {
        client.query("INSERT INTO possessions (fk_user_id, fk_card_id, point) VALUES ($1, $2, $3)", [user_id, card_id, 1]);
        card_id = String(card_id);
        await client.query("COMMIT");
        console.log(`successfully add 1 point to CARD ${card_id}`);
        res.json({
          point: "1",
          cardId: card_id
        });
      } else {
        result = await client.query("SELECT point FROM possessions WHERE fk_card_id = $1 AND fk_user_id = $2", [card_id, user_id]);
        var point_after = result.rows[0].point + 1;
        client.query("UPDATE possessions SET point = $1 WHERE fk_card_id = $2 AND fk_user_id = $3", [point_after, card_id, user_id]);
        point_after = String(point_after);
        card_id = String(card_id);
        await client.query("COMMIT");
        console.log(`successfully add ${point_after} point to CARD ${card_id}`);
        res.json({
          point: point_after,
          cardId: card_id
        });
      }
    } catch {
      console.log("Fail to add point");
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })().catch(err => {
    console.log(err.stack);
    res.json({
      msg: "Fail to add point"
    });
  });
});

app.use("/api", apiRoutes);