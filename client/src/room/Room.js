import React, { useEffect, useState, useRef } from "react";
import { Prompt, useHistory, useParams } from "react-router-dom";
import io from "socket.io-client";
import Peer from "simple-peer";
import DetectRTC from "detectrtc";
import {
  MdMic,
  MdMicOff,
  MdVideocam,
  MdVideocamOff,
  MdPersonAdd,
  MdCallEnd,
} from "react-icons/md";
import { UserVideo } from "./UserVideo";
import { PeerVideo } from "./PeerVideo";
import "./Room.css";

function Room() {
  const history = useHistory();

  // Call state
  const { roomId } = useParams();
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);
  const socketRef = useRef();
  const streamRef = useRef();
  const startTime = useRef();

  // UI state
  const [{ gridWidth, videoWidth, videoHeight }, setGridLayout] = useState({
    gridWidth: 0,
    videoWidth: 0,
    videoHeight: 0,
  });
  const [micEnabled, setMicEnabled] = useState(true);
  const micEnabledRef = useRef(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const camEnabledRef = useRef(true);
  const [callStarted, setCallStarted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const timerRef = useRef();
  const [toast, setToast] = useState(null);
  const [mediaDevicesAccessible, setMediaDevicesAccessible] = useState(true);

  useEffect(() => {
    socketRef.current = io.connect("/");

    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
        constraints: {
          video: {
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
        },
      })
      .then(
        (stream) => {
          if (streamRef.current) streamRef.current.srcObject = stream;

          socketRef.current.emit("joinRoom", roomId);

          socketRef.current.on("otherUsersInRoom", (users) => {
            const peerObjs = [];
            users.forEach((userId) => {
              const peer = createPeer(userId, socketRef.current.id, stream);
              peersRef.current.push({
                peerId: userId,
                peer,
              });
              peerObjs.push({
                peerId: userId,
                peer,
              });
            });
            setPeers(peerObjs);
            recalculateLayout();

            console.log("Joined room with users", users);
          });

          socketRef.current.on("startTimer", (time) => {
            setCallStarted(true);

            startTime.current = time;

            timerRef.current = setInterval(() => {
              setCallTime(new Date().getTime() - startTime.current);
            }, 1000);
          });

          socketRef.current.on("userJoined", (payload) => {
            const peer = addPeer(payload.signal, payload.userId, stream);

            const peerObj = {
              peerId: payload.userId,
              peer,
            };

            peersRef.current.push(peerObj);
            setPeers([...peersRef.current]);
            recalculateLayout();

            console.log("User joined the room", payload.userId);
          });

          socketRef.current.on("signalReceived", (payload) => {
            const item = peersRef.current.find((p) => p.peerId === payload.id);
            item.peer.signal(payload.signal);
          });

          socketRef.current.on("userLeft", (id) => {
            const peerObj = peersRef.current.find((p) => p.peerId === id);
            if (peerObj) {
              peerObj.peer.destroy();
            }
            const peerObjs = peersRef.current.filter((p) => p.peerId !== id);

            peersRef.current = peerObjs;
            setPeers(peerObjs);
            recalculateLayout();

            console.log("User left the room", id);

            if (peersRef.current.length === 0) disconnectFromRoom();
          });
        },
        (error) => {
          DetectRTC.load(() => {
            if (
              !DetectRTC.hasWebcam ||
              !DetectRTC.isWebsiteHasWebcamPermissions ||
              !DetectRTC.hasMicrophone ||
              !DetectRTC.isWebsiteHasMicrophonePermissions
            ) {
              setMediaDevicesAccessible(false);
            }
          });
        }
      );

    function createPeer(userToSignal, userId, stream) {
      const peer = new Peer({
        initiator: true,
        trickle: false,
        objectMode: true,
        stream,
      });

      peer.on("signal", (signal) => {
        socketRef.current.emit("signal", {
          userToSignal,
          userId,
          signal,
        });
      });

      peer.on("connect", () =>
        peer.send(
          JSON.stringify({
            camEnabled: camEnabledRef.current,
            micEnabled: micEnabledRef.current,
          })
        )
      );

      return peer;
    }

    function addPeer(incomingSignal, userId, stream) {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        objectMode: true,
        stream,
      });

      peer.on("signal", (signal) => {
        socketRef.current.emit("signalBack", { signal, userId });
      });

      peer.on("connect", () =>
        peer.send(
          JSON.stringify({
            camEnabled: camEnabledRef.current,
            micEnabled: micEnabledRef.current,
          })
        )
      );

      peer.signal(incomingSignal);

      return peer;
    }

    window.addEventListener("resize", recalculateLayout);

    return () => {
      window.removeEventListener("resize", recalculateLayout);
    };
  }, [roomId]);

  function copyAddressToClipboard() {
    navigator.clipboard.writeText(window.location.href);

    setToast("Room link has been copied to clipboard!");
    setTimeout(() => setToast(null), 3000);
  }

  function toggleCam() {
    peersRef.current.forEach((peerObj) => {
      peerObj.peer.send(
        JSON.stringify({ camEnabled: !camEnabled, micEnabled })
      );
    });

    streamRef.current.srcObject.getVideoTracks()[0].enabled = !streamRef.current.srcObject.getVideoTracks()[0]
      .enabled;
    camEnabledRef.current = !camEnabledRef.current;
    setCamEnabled(camEnabledRef.current);
  }

  function toggleMic() {
    peersRef.current.forEach((peerObj) => {
      peerObj.peer.send(
        JSON.stringify({ camEnabled, micEnabled: !micEnabled })
      );
    });

    streamRef.current.srcObject.getAudioTracks()[0].enabled = !streamRef.current.srcObject.getAudioTracks()[0]
      .enabled;
    micEnabledRef.current = !micEnabledRef.current;
    setMicEnabled(micEnabledRef.current);
  }

  function disconnectFromRoom() {
    clearInterval(timerRef.current);
    socketRef.current.close();
    socketRef.current.srcObject &&
      streamRef.current.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
    peersRef.current = [];
    setPeers([]);

    setCallEnded(true);
    console.log("Disconnected from room");
  }

  function callTimeToString() {
    var hours = Math.floor(callTime / 3600000);
    var minutes = Math.floor((callTime - hours * 3600000) / 60000);
    var seconds = Math.floor(
      (callTime - hours * 3600000 - minutes * 60000) / 1000
    );

    var hoursText = "";
    var minutesText = minutes + ":";
    var secondsText = seconds.toString();

    if (hours > 0) {
      hoursText = hours + ":";
    }
    if (minutes < 10) {
      minutesText = "0" + minutes + ":";
    }
    if (seconds < 10) {
      secondsText = "0" + seconds;
    }
    return hoursText + minutesText + secondsText;
  }

  function recalculateLayout() {
    const aspectRatio =
      peersRef.current.length === 1
        ? window.innerWidth / window.innerHeight
        : 4 / 3;
    const videoCount = peersRef.current.length;
    const containerHeight = window.innerHeight;
    const containerWidth = window.innerWidth;

    let bestLayout = {
      area: 0,
      cols: 0,
      rows: 0,
      width: 0,
      height: 0,
    };

    for (let cols = 1; cols <= videoCount; cols++) {
      const rows = Math.ceil(videoCount / cols);
      const hScale = containerWidth / (cols * aspectRatio);
      const vScale = containerHeight / rows;
      let width;
      let height;
      if (hScale <= vScale) {
        width = Math.floor(containerWidth / cols);
        height = Math.floor(width / aspectRatio);
      } else {
        height = Math.floor(containerHeight / rows);
        width = Math.floor(height * aspectRatio);
      }
      const area = width * height;
      if (area > bestLayout.area) {
        bestLayout = {
          area,
          width,
          height,
          rows,
          cols,
        };
      }
    }

    setGridLayout({
      gridWidth: bestLayout.width * bestLayout.cols,
      videoWidth: bestLayout.width,
      videoHeight: bestLayout.height,
    });
  }

  return (
    <div className="Room">
      {mediaDevicesAccessible && (
        <>
          {!callEnded && (
            <>
              {!callStarted && (
                <div>
                  <div className="Waiting-text">Waiting for peers...</div>
                  <button
                    onClick={copyAddressToClipboard}
                    className="Invite-button"
                  >
                    Invite people
                  </button>
                </div>
              )}

              {callStarted && (
                <div className="Grid" style={{ maxWidth: gridWidth + "px" }}>
                  {peers.map((peer) => {
                    return (
                      <PeerVideo
                        key={peer.peerId}
                        peer={peer.peer}
                        peerId={peer.peerId}
                        width={videoWidth}
                        height={videoHeight}
                      />
                    );
                  })}
                </div>
              )}

              <UserVideo streamRef={streamRef} camEnabled={camEnabled} />

              <div className="Call-time">{callTimeToString()}</div>

              <div className="Buttons-container">
                <button onClick={copyAddressToClipboard} className="Button">
                  <MdPersonAdd />
                </button>
                <button className="Button" onClick={toggleCam}>
                  {camEnabled ? <MdVideocam /> : <MdVideocamOff />}
                </button>
                <button className="Button" onClick={toggleMic}>
                  {micEnabled ? <MdMic /> : <MdMicOff />}
                </button>
                <button
                  className="Button Endcall-button"
                  onClick={disconnectFromRoom}
                >
                  <MdCallEnd />
                </button>
              </div>

              {toast && <div className="Toast">{toast}</div>}

              <Prompt when={true} message={() => disconnectFromRoom()} />
            </>
          )}

          {callEnded && (
            <div>
              <div className="Call-ended-text">The call has ended</div>
              <div className="Call-time-text">
                Duration: {callTimeToString()}
              </div>

              <br></br>

              <button
                className="Reconnect-button"
                onClick={() => window.location.reload()}
              >
                Reconnect to call
              </button>
              <br></br>
              <button className="Home-button" onClick={() => history.push("/")}>
                Back to home
              </button>
            </div>
          )}
        </>
      )}

      {!mediaDevicesAccessible && (
        <div>
          <div className="Device-error-text">Device error</div>
          <div className="Device-error-description-text">
            Please connect a mic and a webcam, grant the required permissions,
            then reload the page
          </div>

          <br></br>

          <button
            className="Reload-button"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      )}
    </div>
  );
}

export default Room;
