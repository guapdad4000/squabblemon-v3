import { completeEngineCrew } from '@workspace/squabblemon-engine/data';
import type { BalanceDeck } from '@workspace/squabblemon-engine/balanceLab';

const deck = (id: string, name: string, ids: string[]): BalanceDeck => ({ id, name, cardIds: completeEngineCrew(ids) });

export const elementDecks: BalanceDeck[] = [
  deck('element-light', 'Light', ['abuela', 'church', 'nightmedic', 'foodz', 'drfade', 'pinaynurse', 'crossingguard', 'leroy', 'yasuke', 'homeless-wiseman']),
  deck('element-water', 'Water', ['monsoonanchor', 'conductor', 'vibe', 'waterboy', 'laundry', 'alchy', 'icecream', 'stillwatermedic', 'riptidebruiser', 'watson']),
  deck('element-plant', 'Plant', ['canopykeeper', 'ashlee', 'gardener', 'sprout', 'rootnurse', 'gardenwall', 'streetapostle', 'homelesslegend', 'rastamon', 'lola']),
  deck('element-electric', 'Electric', ['circuitcaptain', 'piratedj', 'tron', 'plug', 'wiretap', 'batteryback', 'livewire', 'tinman', 'techbro', 'bossbabe']),
  deck('element-dark', 'Dark', ['counter', 'gamer', 'gothkid', 'nerd', 'redpill', 'shonuff', 'queenofhearts', 'repoman', 'thefeds', 'chessregular']),
  deck('element-earth', 'Earth', ['torta', 'concrete', 'mansamusa', 'johnhenry', 'asphaltapostle', 'landlord', 'bigzoey', 'stud', 'bouncer', 'lion']),
  deck('element-fire', 'Fire', ['guap', 'folks', 'hooper', 'bbldemon', 'cornercoach', 'krump', 'og', 'baby', 'youngbull', 'kyle']),
  deck('element-air', 'Air', ['slipstream', 'promoter', 'captainjigga', 'honestthot', 'gust', 'crosswind', 'cloudbreak', 'ptang', 'ogdominican', 'cheshire']),
  deck('element-poison', 'Poison', ['bottle', 'nail', 'mural', 'fein', 'simmy', 'colognecriminal', 'seafoodassassin', 'godofhookah']),
  deck('focus-detective', 'Sherlock and Watson', ['sherlock', 'watson', 'crossingguard', 'nightmedic', 'wifey', 'counter', 'oz', 'rastamon', 'bustdown', 'tinman']),
  deck('focus-demario-luigion', 'Demario and Luigion', ['demario', 'luigion', 'rastamon', 'vibe', 'plug', 'bustdown', 'soulfood', 'black-cowboy', 'hair-stylist', 'stylist']),
  deck('focus-cellblock', 'Cellblock', ['inmate-crafty', 'inmate-boyfriend', 'inmate-informant', 'inmate-contraband', 'inmate-kingpin', 'lebron-james', 'bustdown', 'cognac', 'rastamon', 'wifey']),
  deck('focus-counterplay-coherent', 'Counterplay — Dark Control', ['counter', 'gamer', 'gothkid', 'nerd', 'redpill', 'buddy', 'wifey', 'pinaynurse', 'plug', 'bustdown']),
];
