const express = require("express");
const app = express();
const db = require("./db/dbinfo");
const port = process.env.PORT || 3000;

app.use(express.json()); //いらないかも
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => {
  console.log("Start sever port: " + port);
});

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
    } else {
      var card_ary;
      try {
        var result = await client.query("SELECT fk_card_id, point FROM possessions WHERE fk_user_id = $1", [user_id]);
        console.log(result.rows);
        card_ary = result.rows;
      } catch (err) {
        console.log(err.stack);
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
          }
        } catch (err) {
          console.log(err.stack);
        }
        res.json({
          cardAry: card_ary
        });
      } else {
        res.json({
          msg: "none"
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
      }

      try {
        client.query("INSERT INTO cards (card_name, card_info, url_num) VALUES ($1, $2, $3)", [card_name, card_info, url_num]);
      } catch (err) {
        console.log(err.stack);
      }

      var new_card_id = prvs_card_id + 1;
      try {
        client.query("INSERT INTO admin (fk_card_id, fk_user_id) VALUES ($1, $2)", [new_card_id, user_id]);
      } catch (err) {
        console.log(err.stack);
      }
      
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
    } else {
      try {
        client.query("UPDATE cards SET card_name = $1, card_info = $2 WHERE card_id = $3", [card_name, card_info, card_id]);
      } catch (err) {
        console.log(err.stack);
      }
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
    } else {
      //カードID取得
      var card_id;
      try {
        var result = await client.query("SELECT card_id FROM cards WHERE url_num = $1", [url_num]);
        console.log(result.rows);
        card_id = result.rows[0].card_id;
      } catch (err) {
        console.log(err.stack);
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
      }

      //所持別にポイント付与
      if (chck == 0) {
        try {
          client.query("INSERT INTO possessions (fk_user_id, fk_card_id, point) VALUES ($1, $2, $3)", [user_id, card_id, 1]);
        } catch (err) {
          console.log(err.stack);
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
        }
        try {
          client.query("UPDATE possessions SET point = $1 WHERE fk_card_id = $2 AND fk_user_id = $3", [point_after, card_id, user_id]);
        } catch (err) {
          console.log(err.stack);
        }
        res.json({
          point: point_after,
          cardId: card_id
        });
      }
    }
  });
});