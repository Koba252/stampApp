const express = require("express");
const app = express();
const db = require("./db/dbinfo");
require('dotenv').config();
const port = process.env.ENV_PORT || 5000;

app.use(express.json()); //いらないかも
app.use(express.urlencoded({ extended: true }));

const server = app.listen(port, () => {
  console.log("Start sever port: ${port}");
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
      var slct = "SELECT MAX(card_id) FROM cards";
      client.query(slct, (err, result) => {
        var prvs_card_id;
        if (err) {
          console.log(err);
        } else {
          console.log(result.rows);
          prvs_card_id = result.rows[0].max;
          console.log(prvs_card_id);
          url_num = "" + prvs_card_id + url_num + prvs_card_id;
          Number(url_num);
          console.log(url_num);
        }
        
        var insrt = "INSERT INTO cards (card_name, card_info, url_num) VALUES ($1, $2, $3)";
        client.query(insrt, [card_name, card_info, url_num], (err, result) => {
          if (err) {
            console.log(err);
          }
        });

        var new_card_id = prvs_card_id + 1;
        insrt = "INSERT INTO admin (fk_card_id, fk_user_id) VALUES ($1, $2)";
        client.query(insrt, [new_card_id, user_id], (err) => {
          if (err) {
            console.log(err);
          }
        });

        res.json({
          cardName: card_name,
          cardInfo: card_info,
          cardUrl : url_num,
          cardId: new_card_id
        }); 
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
            cardInfo: result.rows[0].card_info,
            cardId: card_id
          });
        }
      });
    }
  });
});

// ポイント付与
app.post("/api/add", (req, res, next) => {
  console.log("api/add");
  var url_num = req.body.postUrlNum;
  var user_id = req.body.postUesrId;
  console.log(url_num);
  console.log(user_id);
  db.pool.connect( async (err, client) => {
    var point_after = 0;
    if (err) {
      console.log(err);
    } else {
      var card_id;
      
      client.query("SELECT card_id FROM cards WHERE url_num = $1", [url_num], (err, result) =>  {
        if (err) {
          console.log(err);
        } else {
          card_id = result.rows[0].card_id;
          console.log(card_id);
        }

        client.query("SELECT fk_user_id FROM possessions WHERE fk_card_id = $1", [card_id], (err, result) => {
          if (err) {
            console.log(err);
          } else {
            console.log(result.rows);
            var chck = 0;
            for (var i = 0; i < result.rows.length; i ++) {
              if (result.rows[i].fk_user_id == user_id) {
                chck = 1;
                break;
              }
            }
            console.log(chck);
            if (chck == 0) {
              client.query("INSERT INTO possessions (fk_user_id, fk_card_id, point) VALUES ($1, $2, $3)", [user_id, card_id, 0], (err) => {
                if (err) {
                  console.log(err);
                } else {
                  console.log("OK");
                  adding();
                }
              });
            } else {
              adding();
            }
          }
        });
        var adding = () => {
          slct = "SELECT point FROM possessions WHERE fk_card_id = $1 AND fk_user_id = $2";
          client.query(slct, [card_id, user_id], (err, result) => {
            if (err) {
              console.log(err);
            } else {
              console.log(result.rows);
              var rslt = result.rows[0].point;
              console.log(rslt);
              point_after = rslt + 1;
              console.log(point_after);
            }

            var updt = "UPDATE possessions SET point = $1 WHERE fk_card_id = $2 AND fk_user_id = $3";
            client.query(updt, [point_after, card_id, user_id], (err) => {
              if (err) {
                console.log(err);
              } else {
                res.json({
                  point: point_after
                });
              }
            });
          });
        }
      });
    }
  });
});