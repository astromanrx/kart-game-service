import { Room, Client, Delayed } from "colyseus";
import { Appearance, KartRoomState } from "./schema/KartRoomState";
import { ContractAPI } from "./utils/ContractAPI";
export class KartRoom extends Room<KartRoomState> {
  maxClients = 2;
  countdownDuration = 5;  
  gameEndTimeout: Delayed | null = null;
  contractApi: ContractAPI | null = null;


  async onCreate(options: any) {
    console.log("KartRoom created!", options);

    this.setState(new KartRoomState());
    this.contractApi = new ContractAPI();
    await this.contractApi!.init();


    this.onMessage("move", (client, data) => {
      console.log(
        "KartRoom received message from",
        client.sessionId,
        ":",
        data
      );
      this.state.movePlayer(client.sessionId, data);
    });

    this.onMessage("ready", (client) => {
      this.broadcast("ready_report",client.sessionId,{except: client});
      this.state.setPlayerReady(client.sessionId);
      if (this.state.allPlayersReady(this.maxClients)) {
        this.broadcast("load_map");
      }
    });

    

    this.onMessage("finished", (client) => {
      console.log("finished!sss", client.state);
      this.state.playerFinished(client.sessionId);
      if (this.state.finishedCount === this.maxClients) {
        this.endGame();
      }
    });

    this.onMessage("map_loaded",(client)=>{
      this.state.setPlayerMapLoaded(client.sessionId);
      if(this.state.allPlayersMapLoaded(this.maxClients)){
        this.startGameCountdown();
      }
    });

  }

  async updateContractScore(roomId: string, player: string,score: number) {
    try {

      await this.contractApi!.updateScore(roomId, player, score);
    } catch (error) {
      console.error(`Failed to update contract score:`, error);
    }
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
    this.gameEndTimeout = this.clock.setTimeout(() => {
      this.endGame();
    }, 60000);
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
        score: player.score
      }))
      .sort((a, b) => b.score - a.score);

       // 更新每个玩家的合约分数
    for (const result of results) {
      console.log(this.roomId);
      console.log(`Updating contract score for ${result.address}: ${result.score}`);
      await this.updateContractScore(this.roomId, result.address, result.score);
    }

    this.broadcast("gameOver", { results });
  }

  onDispose() {
    console.log("Dispose StateHandlerRoom");
  }
}
