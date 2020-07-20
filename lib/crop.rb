require 'rmagick'

@directory = "renders/seahorse/composite_test"

(0...4096).each do |index|
  file = "#{@directory}/seahorse_#{index}.png"
  image = Magick::Image.read(file).first
  crop = image.crop(0, 0, 739, 415)
  crop.write "#{@directory}/recomposite/#{index}.png"
end