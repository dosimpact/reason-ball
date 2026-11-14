"use client";
import { MagicTweet } from "@/components/magicui/tweet-card";
import { Tweet as RemoteTweet } from "react-tweet";
import type { Tweet } from "react-tweet/api";
import type { MagicProps } from "./types";
import { sampleImage } from "./sample";
export default function TweetCard({tweetId,text="Sample data: build beautiful interfaces with Magic UI."}:MagicProps){
 if(tweetId)return <RemoteTweet id={tweetId}/>;
 const tweet:Tweet={__typename:"Tweet",id_str:"1",lang:"en",created_at:"2026-01-01T00:00:00.000Z",text,display_text_range:[0,text.length],favorite_count:24,conversation_count:3,news_action_type:"conversation",isEdited:false,isStaleEdit:false,entities:{hashtags:[],urls:[],user_mentions:[],symbols:[]},edit_control:{edit_tweet_ids:["1"],editable_until_msecs:"0",is_edit_eligible:false,edits_remaining:"0"},user:{id_str:"1",name:"Magic UI Sample",screen_name:"sample_data",profile_image_url_https:sampleImage,profile_image_shape:"Circle",verified:false,is_blue_verified:false}};
 return <MagicTweet tweet={tweet}/>;
}
