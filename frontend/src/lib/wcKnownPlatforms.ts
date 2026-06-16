export type WcBroadcaster = {
  name: string;
  url: string;
  region: string;
};

/** Official / licensed broadcasters for FIFA World Cup 2026. */
export const WC_OFFICIAL_BROADCASTERS: WcBroadcaster[] = [
  { name: "FIFA+",        url: "https://www.fifa.com/fifaplus",                region: "Global"          },
  { name: "T Sports",     url: "https://tsports.com",                          region: "Bangladesh"      },
  { name: "Fox Sports",   url: "https://www.foxsports.com",                    region: "USA"             },
  { name: "Telemundo",    url: "https://www.telemundo.com",                    region: "USA (Spanish)"   },
  { name: "BBC Sport",    url: "https://www.bbc.co.uk/sport/football",         region: "UK"              },
  { name: "ITV",          url: "https://www.itv.com/watch/sport",              region: "UK"              },
  { name: "Sony LIV",     url: "https://www.sonyliv.com/sports",               region: "India"           },
  { name: "JioTV",        url: "https://www.jio.com/en-in/apps/jiochat",       region: "India"           },
  { name: "beIN Sports",  url: "https://www.bein.net/en/live-tv/",             region: "MENA"            },
  { name: "Viaplay",      url: "https://viaplay.com",                          region: "Scandinavia"     },
  { name: "ARD",          url: "https://www.ardmediathek.de",                  region: "Germany"         },
  { name: "TF1+",         url: "https://www.tf1plus.fr",                       region: "France"          },
  { name: "RTP Play",     url: "https://www.rtp.pt/play",                      region: "Portugal"        },
  { name: "Mitele",       url: "https://www.mitele.es",                        region: "Spain"           },
  { name: "SBS On Demand",url: "https://www.sbs.com.au/ondemand",              region: "Australia"       },
  { name: "Sky Sport NZ", url: "https://www.skysport.co.nz",                   region: "New Zealand"     },
  { name: "SuperSport",   url: "https://supersport.com",                       region: "Africa"          },
  { name: "SPORTV",       url: "https://sportv.globo.com",                     region: "Brazil"          },
  { name: "TSN",          url: "https://www.tsn.ca",                           region: "Canada"          },
  { name: "RDS",          url: "https://www.rds.ca",                           region: "Canada (French)" },
];
