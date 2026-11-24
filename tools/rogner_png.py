#!/usr/bin/env python3
"""
rogner_png.py — Rogne les marges transparentes d'un PNG (sans aucune bibliothèque à installer).

Pourquoi ? Les images exportées par Illustrator gardent la taille du « plan de travail » :
le dessin occupe parfois le tiers de l'image, le reste est transparent. Pour les utiliser
sur le site (logo, étoile…), on garde seulement le rectangle qui contient le dessin.

Utilisation :
    python3 tools/rogner_png.py "DOSSIER RESSOURCES/titre 4 bleu nuit.png" src/da/nova/assets/titre-nuit.png
    python3 tools/rogner_png.py entree.png sortie.png --marge 4        # garde 4 pixels autour
    python3 tools/rogner_png.py entree.png --couleur                    # affiche la couleur dominante

Comment ça marche : on décode le PNG (zlib + « défiltrage » ligne par ligne), on cherche les
lignes et colonnes qui contiennent au moins un pixel non transparent, puis on réécrit le PNG
avec seulement ce rectangle. Format géré : PNG 8 bits RGBA (ce qu'exporte Illustrator).
"""
import struct
import sys
import zlib


def lire_png(chemin):
    """Renvoie (largeur, hauteur, lignes) ; chaque ligne est un bytearray RGBA."""
    donnees = open(chemin, 'rb').read()
    assert donnees[:8] == b'\x89PNG\r\n\x1a\n', 'Ce fichier n\'est pas un PNG'
    position, idat = 8, b''
    while position < len(donnees):
        taille, type_ = struct.unpack('>I4s', donnees[position:position + 8])
        bloc = donnees[position + 8:position + 8 + taille]
        if type_ == b'IHDR':
            largeur, hauteur, profondeur, type_couleur = struct.unpack('>IIBB', bloc[:10])
            assert profondeur == 8 and type_couleur == 6, 'Seul le PNG RGBA 8 bits est géré'
        elif type_ == b'IDAT':
            idat += bloc
        position += 12 + taille
    brut = zlib.decompress(idat)
    octets = largeur * 4
    lignes, precedente = [], bytearray(octets)
    for y in range(hauteur):
        debut = y * (octets + 1)
        filtre, ligne = brut[debut], bytearray(brut[debut + 1:debut + 1 + octets])
        for i in range(octets):
            gauche = ligne[i - 4] if i >= 4 else 0
            haut = precedente[i]
            haut_gauche = precedente[i - 4] if i >= 4 else 0
            if filtre == 1:
                ligne[i] = (ligne[i] + gauche) & 255
            elif filtre == 2:
                ligne[i] = (ligne[i] + haut) & 255
            elif filtre == 3:
                ligne[i] = (ligne[i] + (gauche + haut) // 2) & 255
            elif filtre == 4:  # filtre de Paeth : prend le voisin le plus proche de gauche + haut - haut_gauche
                p = gauche + haut - haut_gauche
                pa, pb, pc = abs(p - gauche), abs(p - haut), abs(p - haut_gauche)
                predit = gauche if pa <= pb and pa <= pc else haut if pb <= pc else haut_gauche
                ligne[i] = (ligne[i] + predit) & 255
        lignes.append(ligne)
        precedente = ligne
    return largeur, hauteur, lignes


def ecrire_png(chemin, largeur, hauteur, lignes):
    def bloc(type_, contenu):
        return struct.pack('>I', len(contenu)) + type_ + contenu + struct.pack('>I', zlib.crc32(type_ + contenu) & 0xFFFFFFFF)
    brut = b''.join(b'\x00' + bytes(ligne) for ligne in lignes)
    with open(chemin, 'wb') as sortie:
        sortie.write(b'\x89PNG\r\n\x1a\n')
        sortie.write(bloc(b'IHDR', struct.pack('>IIBBBBB', largeur, hauteur, 8, 6, 0, 0, 0)))
        sortie.write(bloc(b'IDAT', zlib.compress(brut, 9)))
        sortie.write(bloc(b'IEND', b''))


def rogner(largeur, hauteur, lignes, marge=0):
    """Rectangle (x0, y0, x1, y1) qui contient tous les pixels non transparents."""
    x0, y0, x1, y1 = largeur, hauteur, -1, -1
    for y, ligne in enumerate(lignes):
        for x in range(largeur):
            if ligne[x * 4 + 3] > 0:
                x0, x1 = min(x0, x), max(x1, x)
                y0, y1 = min(y0, y), max(y1, y)
    assert x1 >= 0, 'L\'image est entièrement transparente'
    return max(0, x0 - marge), max(0, y0 - marge), min(largeur - 1, x1 + marge), min(hauteur - 1, y1 + marge)


def couleur_dominante(largeur, lignes):
    """Couleur « #rrggbb » la plus fréquente parmi les pixels opaques."""
    compte = {}
    for ligne in lignes:
        for x in range(largeur):
            if ligne[x * 4 + 3] == 255:
                couleur = bytes(ligne[x * 4:x * 4 + 3])
                compte[couleur] = compte.get(couleur, 0) + 1
    r, g, b = max(compte, key=compte.get)
    return f'#{r:02x}{g:02x}{b:02x}'


if __name__ == '__main__':
    arguments = [a for a in sys.argv[1:] if not a.startswith('--')]
    marge = int(sys.argv[sys.argv.index('--marge') + 1]) if '--marge' in sys.argv else 0
    if '--marge' in sys.argv:
        arguments.remove(str(marge))
    largeur, hauteur, lignes = lire_png(arguments[0])
    if '--couleur' in sys.argv:
        print(couleur_dominante(largeur, lignes))
        sys.exit()
    x0, y0, x1, y1 = rogner(largeur, hauteur, lignes, marge)
    ecrire_png(arguments[1], x1 - x0 + 1, y1 - y0 + 1, [ligne[x0 * 4:(x1 + 1) * 4] for ligne in lignes[y0:y1 + 1]])
    print(f'{arguments[0]}  {largeur}×{hauteur}  →  {x1 - x0 + 1}×{y1 - y0 + 1}')
