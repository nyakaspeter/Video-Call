import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import "./index.css";

import App from "./app/app";
import Room from "./room/room";

ReactDOM.render(
  <React.StrictMode>
    <Router>
      <Switch>
        <Route exact path="/" component={App} />
        <Route path="/:roomId" component={Room} />
      </Switch>
    </Router>
  </React.StrictMode>,
  document.getElementById("root")
);
