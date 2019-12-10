const express = require("express");
const app = express();
const db = require("./db/dbinfo");
require('dotenv').config();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const {check, validationResult} = require("express-validator/check");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => {
  console.log("Start sever port: " + port);
});

app.set("superSecret", process.env.ENV_SSECRET);
var apiRoutes = express.Router();

// ユーザーID取得
var users;
db.pool.connect(async (err, client) => {
  if (err) {
    console.log(err);
    res.json({
      msg: "Fail to connect to database"
    });
  } else {
    try {
      var result = await client.query("SELECT id, pass FROM users");
      console.log(result.rows);
      users = result.rows;
      return users;
    } catch(err) {
      console.log(err.stack);
      res.json({
        msg: "Fail to get user id"
      });
    }
  }
});

// ユーザー登録
app.post("/api/register", [
  check('userId').isAlphanumeric(),
  check('userId').isLength({max: 8}),
  check('userPass').isAlphanumeric(),
  check('userPass').isLength({min: 8, max: 8})
],(req, res) => {
  console.log("/api/register");
  if (!validationResult(req).isEmpty()) {
    console.log(validationResult(req).array());
    return res.status(422).json({
      msg: "Invalid user id or password"
    });
  }
  var post_user_id = req.body.userId;
  var post_user_pass = req.body.userPass;
  db.pool.connect( async (err, client) =>{
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      try {
        var result = await client.query("SELECT id FROM users");
        for (var i = 0; i < result.rows.length; i++) {
          if (result.rows[i].id == post_user_id) {
            return res.json({
              msg: "This user id is already used"
            });
          }
        }
      } catch(err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get user id"
        });
      }
      try {
        client.query("INSERT INTO users (id, pass) VALUES ($1, $2)", [post_user_id, post_user_pass]);
      } catch(err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to add user data"
        });
      }
      var user_id = String(post_user_id);
      var token = jwt.sign(user_id, app.get("superSecret"));
      return res.json({
        msg: "Registration success",
        token: token
      });
    }
  });
});

// トークン発行
apiRoutes.post("/authenticate", (req, res) => {
  console.log("/api2/authenticate");
  console.log(users);
  var post_user_id = req.body.userId;
  var post_user_pass = req.body.userPass;
  for (var i = 0; i < users.length; i++) {
    if (post_user_id == users[i].id && post_user_pass == users[i].pass) {
      var user_id = String(post_user_id);
      var token = jwt.sign(user_id, app.get("superSecret"));
      return res.json({
        msg: "Authentication success",
        token: token
      });
    }
  }
  res.json({
    msg: "Invalid user id or password",
  });
});

// 認証チェック
apiRoutes.use((req, res, next) => {
  var token = req.body.token;
  if (!token) {
    res.json({
      msg: "No token provided"
    });
  }
  jwt.verify(token, app.get("superSecret"), (err, decoded) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Invalid token"
      });
    }
    req.decoded;
    next();
  });
});

apiRoutes.get("/test", (req, res) => {
  console.log("/api2/test");
  var token = req.body.token;
  var decoded = jwt.decode(token, {complete: true});
  console.log(decoded.payload);
  res.json({
    msg: "Hello authenticated world"
  });
});

apiRoutes.post("/list", (req, res) => {
  console.log("/api2/list");
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
      var card_ary;
      try {
        var result = await client.query("SELECT fk_card_id, point FROM possessions WHERE fk_user_id = $1", [user_id]);
        console.log(result.rows);
        card_ary = result.rows;
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get possessions data"
        });
      }

      if (card_ary[0] != null && card_ary[0] != undefined){
        var slct = "id =" + card_ary[0].fk_card_id;
        for (var i = 1; i < card_ary.length; i++) {
          slct += " OR id = " + card_ary[i].fk_card_id;
        }
        try {
          var result = await client.query("SELECT name, img, uplim, info FROM cards WHERE " + slct);
          console.log(result.rows);
          for (var i = 0; i < card_ary.length; i++) {
            card_ary[i].name = result.rows[i].name;
            card_ary[i].img = String(result.rows[i].img);
            card_ary[i].uplim = String(result.rows[i].uplim);
            card_ary[i].info = result.rows[i].info;
            card_ary[i].fk_card_id = String(card_ary[i].fk_card_id);
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
        res.json({
          msg: "The user has no card"
        });
      }
    }
  });
});

app.use("/api2", apiRoutes);



// 接続テスト
app.get("/api/test", (req, res) => {
  console.log("/api/test");
  console.log("GET TEST");
  res.json({data: "hello get world"});
});
app.post("/api/test", (req, res) => {
  console.log("/api/test");
  console.log(req.body.postData);
  res.json({data: req.body.postData});
});

// カード一覧
app.post("/api/list", (req, res) => {
  console.log("api/list");
  var user_id = req.body.postUserId;
  console.log(user_id);
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      var card_ary;
      try {
        var result = await client.query("SELECT fk_card_id, point FROM possessions WHERE fk_user_id = $1", [user_id]);
        console.log(result.rows);
        card_ary = result.rows;
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail get data"
        });
      }

      if (card_ary != null){
        var slct = "card_id =" + card_ary[0].fk_card_id;
        for (var i = 1; i < card_ary.length; i++) {
          slct += " OR card_id = " + card_ary[i].fk_card_id;
        }
        try {
          var result = await client.query("SELECT card_name, card_info FROM cards WHERE " + slct);
          console.log(result.rows);
          for (var i = 0; i < card_ary.length; i++) {
            card_ary[i].card_name = result.rows[i].card_name;
            card_ary[i].card_info = result.rows[i].card_info;
            card_ary[i].fk_card_id = String(card_ary[i].fk_card_id);
            card_ary[i].point = String(card_ary[i].point);
          }
        } catch (err) {
          console.log(err.stack);
          res.json({
            msg: "Fail to get data"
          });
        }
        res.json({
          cardAry: card_ary
        });
      } else {
        res.json({
          msg: "The user has no card"
        });
      }
    }
  });
});

// カード作成
app.post("/api/create", (req, res, next) => {
  console.log("api/create");
  var card_name = req.body.postCardName;
  var card_info = req.body.postCardInfo;
  var user_id = req.body.postUserId;
  var url_num = Math.round(Math.random() * 10000);
  console.log(card_name);
  console.log(card_info);
  console.log(user_id);
  console.log(url_num);
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      var prvs_card_id;
      try {
        var result = await client.query("SELECT MAX(card_id) FROM cards");
        console.log(result.rows);
        prvs_card_id = result.rows[0].max;
        url_num = "" + prvs_card_id + url_num + prvs_card_id;
        Number(url_num);
        console.log(url_num);
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get data"
        });
      }

      try {
        client.query("INSERT INTO cards (card_name, card_info, url_num) VALUES ($1, $2, $3)", [card_name, card_info, url_num]);
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to insert data"
        });
      }

      var new_card_id = prvs_card_id + 1;
      try {
        client.query("INSERT INTO admin (fk_card_id, fk_user_id) VALUES ($1, $2)", [new_card_id, user_id]);
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to insert data"
        });
      }
      url_num = String(url_num);
      new_card_id = String(new_card_id);
      res.json({
        cardName: card_name,
        cardInfo: card_info,
        cardUrl : url_num,
        cardId: new_card_id
      });
    }
  });
});

// カード編集
app.post("/api/edit", (req, res, next) => {
  console.log("/api/edit");
  var card_id = req.body.postCardId;
  var card_name = req.body.postCardName;
  var card_info = req.body.postCardInfo;
  console.log(card_id);
  console.log(card_name);
  console.log(card_info);
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      try {
        client.query("UPDATE cards SET card_name = $1, card_info = $2 WHERE card_id = $3", [card_name, card_info, card_id]);
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to update data"
        });
      }
      card_id = String(card_id);
      res.json({
        cardName: card_name,
        cardInfo: card_info,
        cardId: card_id
      });
    }
  });
});

// ポイント付与
app.post("/api/add", (req, res, next) => {
  console.log("api/add");
  var url_num = req.body.postUrlNum;
  var user_id = req.body.postUserId;
  console.log(url_num);
  console.log(user_id);
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
      res.json({
        msg: "Fail to connect to database"
      });
    } else {
      //カードID取得
      var card_id;
      try {
        var result = await client.query("SELECT card_id FROM cards WHERE url_num = $1", [url_num]);
        console.log(result.rows);
        card_id = result.rows[0].card_id;
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get data"
        });
      }

      //ユーザーがそのカードを所持しているか
      var chck = 0;
      try {
        var result = await client.query("SELECT fk_user_id FROM possessions WHERE fk_card_id = $1", [card_id]);
        console.log(result.rows);
        for (var i = 0; i < result.rows.length; i ++) {
          if (result.rows[i].fk_user_id == user_id) {
            chck = 1;
            break;
          }
          return chck;
        }
      } catch (err) {
        console.log(err.stack);
        res.json({
          msg: "Fail to get data"
        });
      }

      //所持別にポイント付与
      if (chck == 0) {
        try {
          client.query("INSERT INTO possessions (fk_user_id, fk_card_id, point) VALUES ($1, $2, $3)", [user_id, card_id, 1]);
        } catch (err) {
          console.log(err.stack);
          res.json({
            msg: "Fail to insert data"
          });
        }
        console.log("get new card!");
        res.json({
          point: 1,
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
          res.json({
            msg: "Fail to get data"
          });
        }
        try {
          client.query("UPDATE possessions SET point = $1 WHERE fk_card_id = $2 AND fk_user_id = $3", [point_after, card_id, user_id]);
        } catch (err) {
          console.log(err.stack);
          res.json({
            msg: "Fail to update data"
          });
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