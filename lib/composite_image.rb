require 'rmagick'

class CompositeImage
  attr_accessor :directory, :label, :grid_size, :tile_resolution

  def number_of_tiles
    grid_size ** 2
  end

  def file_list(subdivide = 1, subtile_index = 0)
    # renders/seahorse/composite/seahorse_0.png, etc.
    if subdivide == 1
      (0...number_of_tiles).map do |tile|
        # "#{@directory}/#{@label}_#{tile}.png"
        "#{@directory}/subcomposite_#{tile}.png"
      end
    elsif subdivide == 2
      subtiles = []
      (0...4096).each do |tile|
        row = (tile / 64).floor
        col = tile % 64
        new_index = (row / 16).floor * 4 + (col / 16).floor
        if new_index == subtile_index
          subtiles << "#{@directory}/#{@label}#{tile}.png"
        end
      end
      subtiles
    end
  end

  def combine(subdivide = 1, subtile = 16)
    image_list = Magick::ImageList.new(*file_list(subdivide, subtile))
    @@tile_resolution = @tile_resolution
    montage = image_list.montage do
      self.geometry = Magick::Geometry.new(@@tile_resolution[0], @@tile_resolution[1], 0, 0)
    end
    mosaic = montage.mosaic
    if subdivide == 1
      mosaic.write "#{@directory}/composite_render.png"
    else
      mosaic.write "#{@directory}/subcomposite_#{subtile}.png"
    end
  end

  def condense(size)

  end
end

c = CompositeImage.new
c.directory = 'renders/seahorse/composite_test/recomposite'
# c.label = 'seahorse'
c.label = ''
c.tile_resolution = [740, 416]
c.grid_size = 16

# c.combine 1

(0...16).each do |subtile|
  c.combine 2, subtile
end
