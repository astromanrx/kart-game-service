import { Room, Client, Delayed } from "colyseus";
import { Appearance, KartRoomState } from "./schema/KartRoomState";
// import { ContractAPI } from "./utils/ContractAPI";
import { IslandMap, Point } from "./map/map";
 

export class KartRoom extends Room<KartRoomState> {
  maxClients = 2;
  countdownDuration = 5;  
  gameEndTimeout: Delayed | null = null;


  async onCreate(options: any) {
    console.log("KartRoom created!", options);

    this.setState(new KartRoomState());


    this.onMessage("move", (client, data) => {

    

      
      let player = this.state.players.get(client.sessionId)
      if(player && player.finished)
        return;

      this.state.movePlayer(client.sessionId, data);

      if(player){
        
        const oldPosition = <Point>{
          x: player.x,
          y: player.y,
          z: player.z,
        }
  
        const newPosition = <Point>{
          x: data.x,
          y: data.y,
          z: data.z,
        }
  
        let overlappedCheckpoint = IslandMap.IsOverlapCheckpoint(oldPosition,newPosition)
        if(overlappedCheckpoint !== false && overlappedCheckpoint.index > player.lastPassedCheckpoint){
          player.lastPassedCheckpoint = overlappedCheckpoint.index;
          this.broadcast("announce_checkpoint",{
            player: client.sessionId,
            checkpoint: overlappedCheckpoint.index   
          });
          console.log(`Player ${player.address} Checkpoint: ${overlappedCheckpoint.index}`)
        }
  
        if(IslandMap.IsOverlapFinish(oldPosition,newPosition) ){

          if(!player.finished && player.lastPassedCheckpoint  == IslandMap.getCheckpointsNum()-1 && player.lap == IslandMap.getLapsNum()){
            this.state.playerFinished(client.sessionId);
            this.broadcast("announce_finished",client.sessionId);

            console.log(`Player ${player.address} passed finish line!`)


            if(this.state.finishedCount === this.maxClients) {
              this.endGame();
            }
          }          
          
        }
  
        if(IslandMap.IsOverlapStart(oldPosition,newPosition)){
          if(player.lastPassedCheckpoint != -1){
            player.lap++;
            player.lastPassedCheckpoint = -1;
            this.broadcast("announce_lap",{
              player: client.sessionId,
              lap: player.lap   
            });
            console.log(`Player lap: ${player.lap}`)

            console.log(`Player ${player.address} passed start line!`)

          }

          player.passedStartline = true;
          
          
        }
      }
      
    });

    this.onMessage("ready", (client) => {
      this.broadcast("ready_report",client.sessionId,{except: client});
      this.state.setPlayerReady(client.sessionId);
      if (this.state.allPlayersReady(this.maxClients)) {
        this.broadcast("load_map");
      }
    });    

    this.onMessage("map_loaded",(client)=>{
      this.state.setPlayerMapLoaded(client.sessionId);
      if(this.state.allPlayersMapLoaded(this.maxClients)){
        this.startGameCountdown();
      }
      this.broadcast("spawn",client.sessionId);
    });

  }


  onJoin(client: Client, options: { address: string; name: string; }) {
    console.log(client.sessionId, "joined!", options);
    //TODO : user data like name and apearance must loaded from blockchain or database

    this.state.createPlayer(options.address, client.sessionId, options.name, {
      dress: "default",
      gloves: "default",
      hair: "default",
      hat: "default",
      pants: "default",
      shoes: "default",
    } );

    //TODO : send the user a string to sign and verify it, and return access token and refresh token (authenticate using jwt)

    if(this.clients.length === this.maxClients){
      this.broadcast("ready_check");      
    }
  }

  onLeave(client: { sessionId: string }) {
    console.log(client.sessionId, "left!");
    this.state.removePlayer(client.sessionId);
  }
  startGameCountdown() {
    this.state.status = "loading";
    this.broadcast("start_countdown");
    let countdown = this.countdownDuration;
    
    const countdownInterval = this.clock.setInterval(() => {
      if(countdown ==0){
        countdownInterval.clear();
        this.startGame();      
      }else{        
        this.broadcast("update_countdown",countdown);
        countdown--;
      }
      
      
    }, 1000);

  }
  startGame() {
    this.state.status = "playing";
    this.state.startTime = Date.now();
    this.broadcast("start");

    // Set a timeout to end the game after 1 minute if not all players have finished
    // this.gameEndTimeout = this.clock.setTimeout(() => {
    //   this.endGame();
    // }, 60000);
  }

  async endGame() {
    if (this.gameEndTimeout) {
      this.gameEndTimeout.clear();
    }

    this.state.status = "finished";
    const results = Array.from(this.state.players.entries())
      .map(([sessionId, player]) => ({
        sessionId,
        name: player.name,
        address: player.address,
        finished: player.finished,
        finishTime: player.finishTime,
        rank: player.rank
      }))
      .sort((a, b) => b.rank - a.rank);  

    this.broadcast("gameOver", { results });
  }

  onDispose() {
    console.log("Dispose StateHandlerRoom");
  }
}
