export type RewardClip = {
  id: string;
  video: string;
  poster: string;
  duration: number;
  style: "anime" | "live-action";
  tags: ReadonlyArray<"victory" | "defeat" | "draw" | "reward">;
};

export type LoadingScene = {
  id: string;
  label: string;
  video: string;
  poster: string;
  portraitPosition: string;
  landscapePosition: string;
};

export const loadingScenes: readonly LoadingScene[] = [
  {
    id: "loading-sunset-street",
    label: "Sunset street brawl",
    video: "brand/broadcast/loading/sunset-street.mp4",
    poster: "brand/broadcast/loading/sunset-street.jpg",
    portraitPosition: "center 54%",
    landscapePosition: "center 50%",
  },
  {
    id: "loading-squabblehouse",
    label: "Nighttime Squabblehouse",
    video: "brand/broadcast/loading/squabblehouse.mp4",
    poster: "brand/broadcast/loading/squabblehouse.jpg",
    portraitPosition: "center 48%",
    landscapePosition: "center 50%",
  },
  {
    id: "loading-fade-park",
    label: "Crowded Fade Park",
    video: "brand/broadcast/loading/fade-park.mp4",
    poster: "brand/broadcast/loading/fade-park.jpg",
    portraitPosition: "center 50%",
    landscapePosition: "center 51%",
  },
];

const rewardClipDefinitions: readonly Omit<RewardClip, "video" | "poster">[] = [
  {
    id: "anime-opponent-down",
    duration: 1,
    style: "anime",
    tags: ["victory"],
  },
  {
    id: "anime-crowd-draw",
    duration: 1,
    style: "anime",
    tags: ["draw"],
  },
  {
    id: "anime-first-impact",
    duration: 1,
    style: "anime",
    tags: ["victory", "reward"],
  },
  {
    id: "anime-second-impact",
    duration: 1.041667,
    style: "anime",
    tags: ["victory", "reward"],
  },
  {
    id: "anime-uppercut-safe-edit",
    duration: 1.041667,
    style: "anime",
    tags: ["victory", "reward"],
  },
  {
    id: "anime-car-launch",
    duration: 1.041667,
    style: "anime",
    tags: ["victory"],
  },
  {
    id: "anime-fight-clears",
    duration: 2,
    style: "anime",
    tags: ["victory"],
  },
  {
    id: "anime-chef-forward-punch",
    duration: 1.5,
    style: "anime",
    tags: ["victory", "reward"],
  },
  {
    id: "anime-falling-bandana",
    duration: 1.166667,
    style: "anime",
    tags: ["defeat"],
  },
  {
    id: "anime-street-aftermath",
    duration: 1.041667,
    style: "anime",
    tags: ["defeat"],
  },
  {
    id: "live-first-impact",
    duration: 1.791667,
    style: "live-action",
    tags: ["victory"],
  },
  {
    id: "live-finishing-punch",
    duration: 1,
    style: "live-action",
    tags: ["victory"],
  },
  {
    id: "live-knockdown",
    duration: 1.791667,
    style: "live-action",
    tags: ["victory"],
  },
  {
    id: "live-isolated-fist",
    duration: 1.5,
    style: "live-action",
    tags: ["reward"],
  },
  {
    id: "live-sunglasses-jab",
    duration: 1.25,
    style: "live-action",
    tags: ["victory"],
  },
  {
    id: "live-side-kick",
    duration: 1.041667,
    style: "live-action",
    tags: ["victory"],
  },
  {
    id: "live-chef-counter",
    duration: 1.833333,
    style: "live-action",
    tags: ["victory"],
  },
  {
    id: "live-falling-bandana",
    duration: 1.708333,
    style: "live-action",
    tags: ["reward"],
  },
  {
    id: "live-ground-fist",
    duration: 1,
    style: "live-action",
    tags: ["draw"],
  },
  {
    id: "live-crowd-draw",
    duration: 2,
    style: "live-action",
    tags: ["draw"],
  },
  {
    id: "live-last-collapse",
    duration: 1.5,
    style: "live-action",
    tags: ["defeat"],
  },
  {
    id: "live-quiet-aftermath",
    duration: 2,
    style: "live-action",
    tags: ["defeat"],
  },
];

export const rewardClips: readonly RewardClip[] = rewardClipDefinitions.map((clip) => ({
  ...clip,
  video: `brand/broadcast/rewards/${clip.id}.mp4`,
  poster: `brand/broadcast/rewards/${clip.id}.jpg`,
}));