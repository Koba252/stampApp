const express = require("express");
const app = express();
const db = require("./db/dbinfo");

const server = app.listen(3000, () => {
  console.log("Start sever port: 3000");
});

// 接続テスト
app.get("/api/test", (req, res, next) => {
  console.log("/api/test");
  res.json({"Hello": "World"});
});

// カード作成
app.post("/api/create", (req, res, next) => {
  console.log("api/create");
  var card_name = req.query.postCardName;
  var card_info = req.query.postCardInfo;
  var user_id = req.query.postUserId;
  var qr = Math.round(Math.random() * 10000);
  console.log(card_name);
  console.log(card_info);
  console.log(user_id);
  console.log(qr);
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
    } else {
      // qrコード用のURL作成
      var slct = "SELECT MAX(card_id) FROM cards";
      client.query(slct, (err, result) => {
        if (err) {
          console.log(err);
        } else {
          console.log(result.rows);
          rslt = result.rows[0].max;
          console.log(rslt);
          qr = "" + rslt + qr + rslt;
          Number(qr);
          console.log(qr);
        }
        
        // DBに新カード登録
        var insrt = "INSERT INTO cards (card_name, card_info, qr, admin) VALUES ($1, $2, $3, $4)"
        client.query(insrt, [card_name, card_info, qr, user_id], (err, result) => {
          if (err) {
            console.log(err);
          }
        });

        // レスポンス
        res.json({
          cardName: card_name,
          cardInfo: card_info,
          qr : qr
        }); 
      });
    }
  });
});

// カード編集
app.post("/api/edit", (req, res, next) => {
  console.log("/api/edit");
  var card_id = req.query.postCardId; 
  var card_name = req.query.postCardName;
  var card_info = req.query.postCardInfo;
  console.log(card_id);
  console.log(card_name);
  console.log(card_info);
  db.pool.connect( async (err, client) => {
    if (err) {
      console.log(err);
    } else {
      var updt = "UPDATE cards SET card_name = $1, card_info = $2 WHERE card_id = $3";
      client.query(updt, [card_name, card_info, card_id], (err, result) => {
        if (err) {
          console.log(err);
        }
      });
      var slct = "SELECT card_name, card_info FROM cards WHERE card_id = $1";
      client.query(slct, [card_id], (err, result) => {
        if (err) {
          console.log(err);
        } else {
          res.json({
            cardName: result.rows[0].card_name,
            cardInfo: result.rows[0].card_info
          });
        }
      });
    }
  });
});