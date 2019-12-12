const express = require("express");
const app = express();
const db = require("./db/dbinfo");
require('dotenv').config();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const {check, validationResult} = require("express-validator");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  }
  db.pool.connect( async (err, client) =>{
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      try {
        var result = await client.query("SELECT id FROM users");
        console.log(result.rows);
        var target = result.rows.find((item) => {
          return (item.id === users.id);
        });
        console.log(target);
        if (target != undefined) {
          console.log("This user id is already used");
          return res.json({
            token: "-2"
          });
        }
      } catch(err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get user id"
        });
      }
      try {
        client.query("INSERT INTO users (id, pass) VALUES ($1, $2)", [users.id, users.pass]);
      } catch(err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to add user data"
        });
      }
      var user_id = String(users.id);
      var token = jwt.sign(user_id, app.get("superSecret"));
      console.log("Registration success");
      return res.json({
        token: token
      });
    }
  });
});

// トークン発行、ログイン
apiRoutes.post("/authenticate", (req, res) => {
  console.log("/api/authenticate");
  db.pool.connect(async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      var users_list;
      try {
        var result = await client.query("SELECT id, pass FROM users");
        console.log(result.rows);
        users_list = result.rows;
      } catch(err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get user id"
        });
      }
      var users = {
        id: req.body.postUserId,
        pass: req.body.postUserPass
      }
      for (var i = 0; i < users_list.length; i++) {
        if (users.id == users_list[i].id && users.pass == users_list[i].pass) {
          var user_id = String(users.id);
          var token = jwt.sign(user_id, app.get("superSecret"));
          console.log("Authentication success");
          return res.json({
            token: token
          });
        }
      }
      console.log("Invalid user id or password");
      res.json({
        token: "-1"
      });
    }
  });
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
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      var card_ary = [];
      try {
        var result = await client.query("SELECT fk_card_id, point FROM possessions WHERE fk_user_id = $1", [user_id]);
        for (var i = 0; i < result.rows.length; i++) {
          card_ary.push({id: String(result.rows[i].fk_card_id)});
        }
        console.log(card_ary);
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get possessions data"
        });
      }

      if (card_ary[0] != null && card_ary[0] != undefined){
        var slct = "id =" + card_ary[0].id;
        for (var i = 1; i < card_ary.length; i++) {
          slct += " OR id = " + card_ary[i].id;
        }
        try {
          var result = await client.query("SELECT name, img, info FROM cards WHERE " + slct);
          console.log(result.rows);
          for (var i = 0; i < card_ary.length; i++) {
            card_ary[i].name = result.rows[i].name;
            card_ary[i].img = String(result.rows[i].img);
            card_ary[i].info = result.rows[i].info;
            card_ary[i].id = String(card_ary[i].id);
            card_ary[i].point = String(card_ary[i].point);
          }
        } catch (err) {
          console.log(err.stack);
          res.json({
            msg: "Fail to get cards data"
          });
        }
        res.json({
          cardAry: card_ary
        });
      } else {
        var card_ary_none = [
          {
            name: "",
            img: "",
            info: "",
            id: "",
            point: ""
          }
        ];
        console.log("The user has no card");
        res.json({
          cardAry: card_ary_none
        });
      }
    }
  });
});

// 作成カード一覧取得
apiRoutes.post("/works", (req, res) => {
  console.log("/api/works");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  var user_id = decoded.payload;
  console.log(user_id);
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      var created_cards = [];
      try {
        var result = await client.query("SELECT fk_card_id FROM admins WHERE fk_user_id = $1", [user_id]);
        if (result.rows[0] == null) {
          console.log("This user has no created card");
          var created_cards_none = [{
            id: "",
            name: "",
            img: "",
            info: "",
            url: ""
          }];
          return res.json({
            createdCards: created_cards_none
          });
        }
        for (var i = 0; i < result.rows.length; i++) {
          created_cards.push({id: String(result.rows[i].fk_card_id)});
        }
      } catch (err) {
        console.log(err.stack);
        return res.json({
          msg: "Fail to get admins data"
        });
      }
      console.log(created_cards);
      var slct = "id =" + created_cards[0].id;
      for (var i = 1; i < created_cards.length; i++) {
        slct += " OR id = " + created_cards[i].id;
      }
      try {
        var result = await client.query("SELECT name, img, info, url FROM cards WHERE " + slct);
        for (var i = 0; i < result.rows.length; i++) {
          created_cards[i].name = result.rows[i].name;
          created_cards[i].img = String(result.rows[i].img);
          created_cards[i].info = result.rows[i].info;
          created_cards[i].url = String(result.rows[i].url);
        }
      } catch (err) {
        console.log(err.stack);
        return res.json({
          msg: "Fail to get cards data"
        });
      }
      console.log(created_cards);
      res.json({
        createdCards: created_cards
      });
    }
  });
});

// 作成
apiRoutes.post("/create", (req, res, next) => {
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
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      var prvs_card_id;
      try {
        var result = await client.query("SELECT MAX(id) FROM cards");
        console.log(result.rows);
        prvs_card_id = result.rows[0].max;
        cards.url = "" + prvs_card_id + cards.url + prvs_card_id;
        Number(cards.url);
        console.log(cards.url);
      } catch (err) {
        console.log(err.stack);
        return res.json({
          msg: "Fail to get card id"
        });
      }

      try {
        client.query("INSERT INTO cards (name, img, info, url) VALUES ($1, $2, $3, $4)", [cards.name, cards.img, cards.info, cards.url]);
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to insert data"
        });
      }

      var new_card_id = prvs_card_id + 1;
      try {
        client.query("INSERT INTO admins (fk_user_id, fk_card_id) VALUES ($1, $2)", [user_id, new_card_id]);
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to insert data"
        });
      }
      cards.url = String(cards.url);
      new_card_id = String(new_card_id);
      res.json({
        cardName: cards.name,
        cardImg: cards.img,
        cardInfo: cards.info,
        cardUrl : cards.url,
        cardId: new_card_id
      });
    }
  });
});

// 編集
apiRoutes.post("/edit", (req, res, next) => {
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
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      try {
        var result = await client.query("SELECT fk_user_id FROM admins WHERE fk_card_id = $1", [cards.id]);
        console.log(result.rows);
        var target = result.rows.find((item) => {
          return (item.fk_user_id === user_id)
        });
        console.log(target);
        if (target == undefined) {
          return res.json({
            msg: "This user do not have control of this card"
          });
        }
      } catch(err) {
        console.log(err.stack);
        return res.json({
          msg: "Fail to get admins data"
        });
      }
      try {
        client.query("UPDATE cards SET name = $1, img = $2, info = $3 WHERE id = $4", [cards.name, cards.img, cards.info, cards.id]);
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to update data"
        });
      }
      cards.id = String(cards.id);
      cards.img = String(cards.img);
      res.json({
        cardId: cards.id,
        cardName: cards.name,
        cardImg: cards.img,
        cardInfo: cards.info
      });
    }
  });
});

// ポイント付与
apiRoutes.post("/add", (req, res, next) => {
  console.log("api/add");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  var user_id = decoded.payload;
  var url_num = req.body.postUrlNum;
  console.log(user_id);
  console.log(url_num);
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      var card_id;
      try {
        var result = await client.query("SELECT id FROM cards WHERE url = $1", [url_num]);
        console.log(result.rows);
        card_id = result.rows[0].id;
      } catch (err) {
        console.log(err.stack);
        return res.json({
          msg: "Fail to get cards data"
        });
      }
      //ユーザーがそのカードを所持しているか
      var target;
      try {
        var result = await client.query("SELECT fk_card_id FROM possessions WHERE fk_user_id = $1", [user_id]);
        console.log(result.rows);
        target = result.rows.find((item) => {
          return (item.fk_card_id === card_id);
        });
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get possessions data"
        });
      }
      if (target == undefined) {
        try {
          client.query("INSERT INTO possessions (fk_user_id, fk_card_id, point) VALUES ($1, $2, $3)", [user_id, card_id, 1]);
        } catch (err) {
          console.log(err.stack);
        }
        card_id = String(card_id);
        res.json({
          point: "1",
          cardId: card_id
        });
      } else {
        var point_after = 0;
        try {
          var result = await client.query("SELECT point FROM possessions WHERE fk_card_id = $1 AND fk_user_id = $2", [card_id, user_id]);
          console.log(result.rows);
          point_after = result.rows[0].point + 1;
        } catch (err) {
          console.log(err.stack);
          return res.json({
            msg: "Fail to get possessions data"
          });
        }
        try {
          client.query("UPDATE possessions SET point = $1 WHERE fk_card_id = $2 AND fk_user_id = $3", [point_after, card_id, user_id]);
        } catch (err) {
          console.log(err.stack);
        }
        point_after = String(point_after);
        card_id = String(card_id);
        res.json({
          point: point_after,
          cardId: card_id
        });
      }
    }
  });
});

app.use("/api", apiRoutes);