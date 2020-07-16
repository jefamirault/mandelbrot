require 'rmagick'

class CompositeImage
  attr_accessor :directory, :label, :grid_size, :tile_resolution

  def number_of_tiles
    grid_size ** 2
  end

  def file_list
    # renders/seahorse/composite/seahorse_0.png, etc.
    (0...number_of_tiles).map do |tile|
      "#{@directory}/#{@label}_#{tile}.png"
    end
  end

  def combine
    image_list = Magick::ImageList.new(*file_list)
    @@tile_resolution = @tile_resolution
    montage = image_list.montage do
      self.geometry = Magick::Geometry.new(@@tile_resolution[0], @@tile_resolution[1], 0, 0)
    end
    mosaic = montage.mosaic
    mosaic.write "#{@directory}/composite_render.png"
  end
end
#
# c = CompositeImage.new
# c.directory = 'renders/seahorse/composite_test'
# c.tile_resolution = []100, 100]
# c.label = 'seahorse'
# c.grid_size = 16
#
# c.combine
