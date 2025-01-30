import matplotlib.pyplot as plt
import numpy as np

import matplotlib
import matplotlib as mpl


def show_confusion_matrix(conf_mat:list, claims:list, title:str, filename:str)->str:
  claims = [row[0] for row in conf_mat]

  vegetables = claims
  farmers = claims

  harvest = np.array(conf_mat)
  fig, ax = plt.subplots()
 # im = ax.imshow(harvest)

  ax.set_aspect("equal")

  # Show all ticks and label them with the respective list entries
  ax.set_xticks(np.arange(len(farmers)), labels=farmers)
  ax.set_yticks(np.arange(len(vegetables)), labels=vegetables)

  # Rotate the tick labels and set their alignment.
  plt.setp(ax.get_xticklabels(), rotation=25, ha="right",
         rotation_mode="anchor")

  # Loop over data dimensions and create text annotations.
  for i in range(len(vegetables)):
    for j in range(len(farmers)):
      text = ax.text(j, i, harvest[i, j],
                       ha="center", va="center",
                       #fontsize="x-small",
                       color="w")

  ax.set_title(title)
  plt.savefig(filename, bbox_inches='tight')
  #fig.tight_layout()
  ##plt.show()
  return filename
